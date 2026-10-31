import { reportInputSchema } from "@/lib/schemas";
import { authErrorResponse, requireUser } from "@/lib/supabase/server";
import { loadReports } from "@/lib/db-mappers";
import { appendEvent, getMappedReport, imageContentMatches, imageExtension, imageTypeAllowed, processSavedReport } from "@/lib/report-service";

export async function GET() {
  try {
    const { admin, profile } = await requireUser();
    let query = admin.from("reports").select("*").eq("is_synthetic", false).order("created_at", { ascending: false }).limit(500);
    if (profile.role !== "admin") query = query.eq("reporter_id", profile.id);
    const { data, error } = await query;
    if (error) throw error;
    return Response.json({ reports: await loadReports(admin, data || []) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { admin, user, profile } = await requireUser();
    const form = await request.formData();
    const parsed = reportInputSchema.safeParse({ originalText: form.get("originalText"), language: form.get("language"), building: form.get("building"), area: form.get("area") || "", ...(form.get("category") ? { category: form.get("category") } : {}) });
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Review the report fields and try again." }, { status: 400 });
    const file = form.get("image");
    if (file && file instanceof File && file.size > 15 * 1024 * 1024) return Response.json({ error: "Images must be 15 MB or smaller." }, { status: 413 });
    if (file && file instanceof File && file.size > 0 && !imageTypeAllowed(file.type)) return Response.json({ error: "Use a JPEG, PNG, WebP, or HEIC image." }, { status: 415 });
    const { data: canSubmit, error: limitError } = await admin.rpc("consume_report_submission_slot", { p_user_id: user.id, p_limit: 10 });
    if (limitError) throw limitError;
    if (!canSubmit) return Response.json({ error: "You have reached the report limit. Try again in about an hour." }, { status: 429, headers: { "Retry-After": "3600", "Cache-Control": "no-store" } });
    const fileBytes = file instanceof File && file.size > 0 ? Buffer.from(await file.arrayBuffer()) : null;
    if (file instanceof File && fileBytes && !imageContentMatches(file.type, fileBytes)) return Response.json({ error: "The selected file does not match its image type." }, { status: 415 });

    // Persist the original before image processing or any Gemini request.
    const { data: row, error: insertError } = await admin.from("reports").insert({
      reporter_id: user.id, original_text: parsed.data.originalText, original_language: parsed.data.language,
      category: parsed.data.category || "Other", location_building: parsed.data.building, location_area: parsed.data.area,
      status: "Under review", analysis_status: "pending",
    }).select("*").single();
    if (insertError || !row) { console.error("Report insert failed", insertError); return Response.json({ error: "The report could not be saved. Please try again." }, { status: 500 }); }
    try { await appendEvent(admin, { reportId: row.id, actorId: user.id, actorName: profile.full_name, newStatus: "Under review", message: "Report received and queued for analysis." }); }
    catch (eventError) { console.error("Report event could not be recorded", eventError); }

    let attachmentError: string | null = null;
    let hasImage = false;
    if (file instanceof File && file.size > 0) {
      const path = `${row.id}/${crypto.randomUUID()}${imageExtension(file.type)}`;
      const { error: uploadError } = await admin.storage.from("report-attachments").upload(path, fileBytes!, { contentType: file.type, upsert: false });
      if (uploadError) { console.error("Report photo upload failed", uploadError); attachmentError = "Photo could not be stored. The written report is still saved."; }
      else {
        const { error: attachmentInsertError } = await admin.from("attachments").insert({ report_id: row.id, storage_path: path, mime_type: file.type, size_bytes: file.size });
        if (attachmentInsertError) { console.error("Report attachment record insert failed", attachmentInsertError); await admin.storage.from("report-attachments").remove([path]); attachmentError = "Photo could not be attached. The written report is still saved."; }
        else hasImage = true;
      }
    }

    let result: Awaited<ReturnType<typeof processSavedReport>> | null = null;
    try { result = await processSavedReport(admin, row.id, false); }
    catch (analysisError) {
      console.error("Saved report processing failed", analysisError);
      const message = "AI processing could not be completed. An administrator can retry.";
      await admin.from("reports").update({ analysis_status: "failed", analysis_error: message }).eq("id", row.id);
    }
    if (attachmentError) {
      await admin.from("reports").update({ analysis_error: attachmentError }).eq("id", row.id);
      if (result?.report) result.report.analysisError = attachmentError;
    }
    const report = result?.report || await getMappedReport(admin, row.id);
    return Response.json({ report, matches: result?.matches || [], analysisError: attachmentError || result?.analysisError || null, attachmentSaved: !file || file instanceof File && file.size === 0 || hasImage }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}
