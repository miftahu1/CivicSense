import { after, NextRequest } from "next/server";
import { reportInputSchema } from "@/lib/schemas";
import { authErrorResponse, requireUser } from "@/lib/supabase/server";
import { loadReports } from "@/lib/db-mappers";
import { appendEvent, imageContentMatches, imageExtension, imageTypeAllowed, processSavedReport, processReportImage } from "@/lib/report-service";
import { imageFingerprint, verifyImageReportDraft } from "@/lib/image-report-draft";
import { notifyDepartmentForReport } from "@/lib/emailjs";
import { consumeAbuseRateLimit, createAutomaticIpCooldown, hmacFingerprint, recordAbuseEvent } from "@/lib/abuse-protection";

export async function GET(request: NextRequest) {
  try {
    const { admin, profile } = await requireUser();
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");
    const offset = (page - 1) * pageSize;

    let query = admin.from("reports").select("*", { count: "exact" }).eq("is_synthetic", false).order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
    if (profile.role !== "admin") query = query.eq("reporter_id", profile.id);
    const { data, error, count } = await query;
    if (error) throw error;
    return Response.json({ reports: await loadReports(admin, data || []), count: count || 0 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  try {
    const { admin, user, profile, ipHash } = await requireUser();
    const form = await request.formData();
    const draftToken = form.get("imageDraftToken");
    const imageDraft = typeof draftToken === "string" ? verifyImageReportDraft(draftToken) : null;
    if (draftToken && !imageDraft) return Response.json({ error: "This image analysis draft has expired or is invalid. Analyze the photo again to continue." }, { status: 400 });
    const optionalNumber = (name: string) => {
      const value = form.get(name);
      return typeof value === "string" && value.trim() ? Number(value) : undefined;
    };
    const parsed = reportInputSchema.safeParse({
      originalText: form.get("originalText"), language: form.get("language") || undefined,
      building: form.get("building"), area: form.get("area") || "",
      latitude: optionalNumber("latitude"), longitude: optionalNumber("longitude"), accuracyMeters: optionalNumber("accuracyMeters"),
      publicOptOut: form.get("publicOptOut") === "true", ...(form.get("category") ? { category: form.get("category") } : {}),
    });
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Review the report fields and try again." }, { status: 400 });
    const file = form.get("image");
    if (file && file instanceof File && file.size > 15 * 1024 * 1024) return Response.json({ error: "Images must be 15 MB or smaller." }, { status: 413 });
    if (file && file instanceof File && file.size > 0 && !imageTypeAllowed(file.type)) return Response.json({ error: "Use a JPEG, PNG, WebP, or HEIC image." }, { status: 415 });
    const fileBytes = file instanceof File && file.size > 0 ? Buffer.from(await file.arrayBuffer()) : null;
    if (file instanceof File && fileBytes && !imageContentMatches(file.type, fileBytes)) return Response.json({ error: "The selected file does not match its image type." }, { status: 415 });
    if (imageDraft && (!fileBytes || imageDraft.userId !== user.id || imageDraft.building !== parsed.data.building || imageDraft.area !== parsed.data.area || imageDraft.imageHash !== imageFingerprint(fileBytes))) {
      return Response.json({ error: "The photo or location changed after analysis. Analyze the current photo and location again." }, { status: 400 });
    }
    const accountBurst = await consumeAbuseRateLimit(admin, `account:${user.id}:report`, 600, 4);
    if (!accountBurst.allowed) {
      await recordAbuseEvent(admin, { userId: user.id, ipHash, eventType: "report_burst_limited", riskScore: 2, details: { count: accountBurst.request_count, windowSeconds: 600 } }).catch((error) => console.error("Abuse event could not be recorded", error));
      return Response.json({ error: "You have submitted reports quickly. Please wait a few minutes before submitting another.", code: "REPORT_RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(accountBurst.retry_after_seconds), "Cache-Control": "no-store" } });
    }
    if (ipHash) {
      const ipBurst = await consumeAbuseRateLimit(admin, `ip:${ipHash}:report`, 600, 60);
      if (!ipBurst.allowed) {
        const autoBlocked = ipBurst.request_count === 61
          ? await createAutomaticIpCooldown(admin, ipHash, "Automatic 15-minute network cooldown after exceeding 60 report submissions in 10 minutes.", 15).catch((error) => { console.error("Automatic IP cooldown could not be applied", error); return null; })
          : null;
        await recordAbuseEvent(admin, { userId: user.id, ipHash, eventType: autoBlocked ? "network_auto_blocked" : "network_burst_limited", riskScore: autoBlocked ? 8 : 4, details: { count: ipBurst.request_count, windowSeconds: 600, ...(autoBlocked ? { expiresAt: autoBlocked.expiresAt, restrictionId: autoBlocked.id } : {}) } }).catch((error) => console.error("Abuse event could not be recorded", error));
        return Response.json({ error: "This network has submitted many reports recently. Please wait a few minutes and try again.", code: "NETWORK_RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(ipBurst.retry_after_seconds), "Cache-Control": "no-store" } });
      }
    }
    let repeatedContentCount = 0;
    const normalizedText = parsed.data.originalText.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const contentFingerprint = hmacFingerprint(normalizedText);
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentReports, error: recentReportsError } = await admin.from("reports").select("original_text")
      .eq("reporter_id", user.id).eq("is_synthetic", false).gte("created_at", cutoff).order("created_at", { ascending: false }).limit(30);
    if (recentReportsError) console.warn("Recent report repetition check failed", { userId: user.id, error: recentReportsError });
    else repeatedContentCount = (recentReports || []).filter((previous) => hmacFingerprint(previous.original_text.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()) === contentFingerprint).length;
    const suspiciousSolicitation = /(?:https?:\/\/|www\.)/i.test(parsed.data.originalText)
      && /\b(?:upi|payment|pay\s+now|transfer\s+money|password|one.time.password|\botp\b|\bpin\b|verify\s+(?:your\s+)?account|login\s+details)\b/i.test(parsed.data.originalText);
    const imageDraftModified = imageDraft ? parsed.data.originalText.trim() !== imageDraft.suggestions.description || parsed.data.category !== imageDraft.suggestions.category : false;
    const { data: canSubmit, error: limitError } = await admin.rpc("consume_report_submission_slot", { p_user_id: user.id, p_limit: 10 });
    if (limitError) throw limitError;
    if (!canSubmit) return Response.json({ error: "You have reached the report limit. Try again in about an hour." }, { status: 429, headers: { "Retry-After": "3600", "Cache-Control": "no-store" } });
    // Persist the original before image processing or any Gemini request.
    const { data: row, error: insertError } = await admin.from("reports").insert({
      reporter_id: user.id, original_text: parsed.data.originalText, original_language: parsed.data.language,
      category: parsed.data.category || imageDraft?.suggestions.category || "Other", location_building: parsed.data.building, location_area: parsed.data.area,
      location_latitude: parsed.data.latitude ?? null, location_longitude: parsed.data.longitude ?? null,
      location_accuracy_meters: parsed.data.accuracyMeters ?? null,
      public_opt_out: parsed.data.publicOptOut,
      suggested_priority: imageDraft?.suggestions.priority || "Medium",
      priority_explanation: imageDraft?.suggestions.priorityExplanation || "",
      status: "Under review", analysis_status: "pending", image_analysis_status: fileBytes ? (imageDraft ? "complete" : "pending") : "complete",
    }).select("*").single();
    if (insertError || !row) { console.error("Report insert failed", insertError); return Response.json({ error: "The report could not be saved. Please try again." }, { status: 500 }); }
    console.info("Report row saved", { reportId: row.id, durationMs: Date.now() - requestStartedAt });
    if (repeatedContentCount >= 2) await recordAbuseEvent(admin, { userId: user.id, ipHash, reportId: row.id, eventType: "repeated_report_content", riskScore: 4, details: { priorMatchesInLastHour: repeatedContentCount } }).catch((error) => console.error("Abuse event could not be recorded", error));
    if (suspiciousSolicitation) await recordAbuseEvent(admin, { userId: user.id, ipHash, reportId: row.id, eventType: "suspicious_link_or_solicitation", riskScore: 5, details: { reason: "A link appears alongside a payment or credential request." } }).catch((error) => console.error("Abuse event could not be recorded", error));
    try { await appendEvent(admin, { reportId: row.id, actorId: user.id, actorName: profile.full_name, newStatus: "Under review", message: "Report received and queued for analysis." }); }
    catch (eventError) { console.error("Report event could not be recorded", eventError); }

    let attachmentError: string | null = null;
    let hasImage = false;
    if (file instanceof File && file.size > 0) {
      const photoUploadStartedAt = Date.now();
      const path = `${row.id}/${crypto.randomUUID()}${imageExtension(file.type)}`;
      const { error: uploadError } = await admin.storage.from("report-attachments").upload(path, fileBytes!, { contentType: file.type, upsert: false });
      if (uploadError) { console.error("Report photo upload failed", uploadError); attachmentError = "Photo could not be stored. The written report is still saved."; }
      else {
        const { error: attachmentInsertError } = await admin.from("attachments").insert({ report_id: row.id, storage_path: path, mime_type: file.type, size_bytes: file.size });
        if (attachmentInsertError) { console.error("Report attachment record insert failed", attachmentInsertError); await admin.storage.from("report-attachments").remove([path]); attachmentError = "Photo could not be attached. The written report is still saved."; }
        else hasImage = true;
      }
      console.info("Report photo upload finished", { reportId: row.id, durationMs: Date.now() - photoUploadStartedAt, saved: hasImage });
    }

    if (attachmentError) await admin.from("reports").update({ analysis_error: attachmentError }).eq("id", row.id);

    if (hasImage && !imageDraft) {
      after(() => processReportImage(admin, row.id));
    }

    const { report, matches, analysisError } = await processSavedReport(admin, row.id, false, imageDraft ? {
      ...(imageDraftModified ? { categoryHint: parsed.data.category || undefined, categoryOverride: parsed.data.category || undefined } : {}),
    } : undefined);

    if (report) after(() => notifyDepartmentForReport(admin, row.id));

    console.info("Report submission response ready", { reportId: row.id, durationMs: Date.now() - requestStartedAt });
    return Response.json({ report, matches, analysisError, attachmentSaved: !file || file instanceof File && file.size === 0 || hasImage }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}
