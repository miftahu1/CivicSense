import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeImage, analyzeReport, embedReport } from "@/lib/ai";
import { normalizeDepartment } from "@/lib/departments";
import { loadReports, mapReport } from "@/lib/db-mappers";
import type { Category, Language, Report, SimilarReport } from "@/lib/types";

const allowedImages = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
const allowedExtensions: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/heic": ".heic" };
export const imageTypeAllowed = (mime: string) => allowedImages.has(mime);
export const imageExtension = (mime: string) => allowedExtensions[mime] || ".img";

export function imageContentMatches(mime: string, bytes: Buffer) {
  if (mime === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === "image/webp") return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (mime === "image/heic") return bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp" && ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(bytes.toString("ascii", 8, 12));
  return false;
}

export async function getReportRow(admin: SupabaseClient, reportId: string) {
  const { data, error } = await admin.from("reports").select("*").eq("id", reportId).eq("is_synthetic", false).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMappedReport(admin: SupabaseClient, reportId: string): Promise<Report | null> {
  const row = await getReportRow(admin, reportId);
  if (!row) return null;
  const [report] = await loadReports(admin, [row]);
  return report || mapReport(row);
}

export async function saveEmbedding(admin: SupabaseClient, reportId: string, values: number[]) {
  const literal = `[${values.join(",")}]`;
  const { error } = await admin.rpc("save_report_embedding", { p_report_id: reportId, p_embedding_text: literal, p_model_name: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2" });
  if (error) throw error;
}

export async function findSimilarReports(admin: SupabaseClient, input: { text: string; building: string; area: string; excludeReportId?: string }) {
  const values = await embedReport(input.text, input.building, input.area);
  const { data, error } = await admin.rpc("match_reports", {
    p_query_embedding: `[${values.join(",")}]`,
    p_exclude_report_id: input.excludeReportId || null,
    p_location_building: input.building,
    p_threshold: Number(process.env.SIMILARITY_THRESHOLD || "0.82"),
    p_match_count: 3,
  });
  if (error) throw error;
  return { values, candidates: (data || []) as Array<{ report_id: string; similarity: number; cosine_similarity: number; location_match: boolean }> };
}

export async function buildSimilarReports(
  admin: SupabaseClient,
  values: Array<{ report_id: string; similarity: number; cosine_similarity?: number; location_match: boolean }>,
  source: { language: Language; building?: string; area?: string; category?: Report["category"]; createdAt?: string },
  isAdmin: boolean,
): Promise<SimilarReport[]> {
  if (!values.length) return [];
  const { data, error } = await admin.from("reports").select("*").in("id", values.map((value) => value.report_id)).eq("is_synthetic", false).neq("status", "Resolved");
  if (error || !data?.length) return [];
  const mapped = await loadReports(admin, data);
  const byId = new Map(mapped.map((report) => [report.id, report]));
  return values.flatMap((value) => {
    const report = byId.get(value.report_id);
    if (!report) return [];
    const languageDiffers = source.language !== report.originalLanguage;
    const normalizeArea = (area: string) => area.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const sourceArea = normalizeArea(source.area || "");
    const candidateArea = normalizeArea(report.area);
    const partialAreaMatch = Math.min(sourceArea.length, candidateArea.length) >= 8 && (sourceArea.includes(candidateArea) || candidateArea.includes(sourceArea));
    const sameArea = Boolean(sourceArea && candidateArea && (sourceArea === candidateArea || partialAreaMatch));
    const sameCategory = Boolean(source.category && source.category === report.category);
    const sourceTime = source.createdAt ? Date.parse(source.createdAt) : Date.parse(report.createdAt);
    const candidateTime = Date.parse(report.createdAt);
    const daysApart = Number.isFinite(sourceTime) && Number.isFinite(candidateTime)
      ? Math.floor(Math.abs(sourceTime - candidateTime) / 86_400_000)
      : 0;
    const normalizeBuilding = (building: string) => building.normalize("NFKC").trim().toLocaleLowerCase();
    const sameBuilding = value.location_match || Boolean(source.building && normalizeBuilding(source.building) === normalizeBuilding(report.building));
    const contextSignals = [sameBuilding, sameArea, sameCategory].filter(Boolean).length;
    const explanation = contextSignals >= 2
      ? languageDiffers ? "The text is semantically similar and multiple context details also align. The reports use different languages." : "The text is semantically similar and multiple context details also align."
      : sameBuilding
        ? "The text is semantically similar and the building matches; check the exact area and issue details before grouping."
        : "The text is semantically similar, but the location differs. Confirm these describe the same underlying issue before grouping.";
    const explanationAs = contextSignals >= 2
      ? languageDiffers ? "বিৱৰণৰ অৰ্থৰ মিল আছে আৰু প্ৰসংগৰ কেইবাটাও তথ্যও একে। প্ৰতিবেদন দুটা বেলেগ ভাষাত লিখা হৈছে।" : "বিৱৰণৰ অৰ্থৰ মিল আছে আৰু প্ৰসংগৰ কেইবাটাও তথ্যও একে।"
      : sameBuilding
        ? "বিৱৰণৰ অৰ্থৰ মিল আছে আৰু ভৱনটো একে; একেলগ কৰাৰ আগতে নিৰ্দিষ্ট ঠাই আৰু সমস্যাটো পৰীক্ষা কৰক।"
        : "বিৱৰণৰ অৰ্থৰ মিল আছে, কিন্তু স্থান বেলেগ। একেলগ কৰাৰ আগতে এইবোৰ একেটা মূল সমস্যাৰ বিষয়ে নে নিশ্চিত কৰক।";
    const reportWithoutPreciseLocation = { ...report, latitude: null, longitude: null, locationAccuracyMeters: null };
    const safeReport = isAdmin ? reportWithoutPreciseLocation : { ...reportWithoutPreciseLocation, reporterName: "Campus community member", reporterId: "", originalText: "", imageUrl: undefined, imageCaption: undefined, events: [] };
    return [{
      report: safeReport,
      score: Number(value.cosine_similarity ?? value.similarity),
      explanation,
      explanationAs,
      evidence: { sameBuilding, sameArea, sameCategory, differentLanguage: languageDiffers, daysApart },
    }];
  }).sort((a, b) => b.score - a.score);
}

export async function processReportImage(admin: SupabaseClient, reportId: string) {
    const { data: attachment } = await admin.from("attachments").select("storage_path,mime_type").eq("report_id", reportId).maybeSingle();
    if (!attachment) return;

    try {
        await admin.from("reports").update({ image_analysis_status: "in_progress" }).eq("id", reportId);
        const { data: downloaded, error } = await admin.storage.from("report-attachments").download(attachment.storage_path);
        if (error) throw error;

        const image = { mimeType: attachment.mime_type, bytes: Buffer.from(await downloaded.arrayBuffer()) };
        const description = await analyzeImage(image);

        await admin.from("attachments").update({ image_caption: description }).eq("report_id", reportId);
        await admin.from("reports").update({ image_analysis_status: "complete" }).eq("id", reportId);
    } catch (error) {
        console.error("Image analysis failed", { reportId, error });
        await admin.from("reports").update({ image_analysis_status: "failed" }).eq("id", reportId);
    }
}

export async function processSavedReport(admin: SupabaseClient, reportId: string, isAdmin = true, options: {
  categoryHint?: Category;
  categoryOverride?: Category;
} = {}) {
  const row = await getReportRow(admin, reportId);
  if (!row) throw new Error("Report not found.");
  
  let analysisError: string | null = null;
  
  let analysis: Awaited<ReturnType<typeof analyzeReport>> | null = null;
  let embeddingValues: number[] | null = null;
  const aiStartedAt = Date.now();
  const [analysisResult, embeddingResult] = await Promise.allSettled([
    analyzeReport({ text: row.original_text, building: row.location_building, area: row.location_area || "", category: options.categoryHint }),
    embedReport(row.original_text, row.location_building, row.location_area || ""),
  ]);
  console.info("Report AI calls finished", { reportId, durationMs: Date.now() - aiStartedAt, analysis: analysisResult.status, embedding: embeddingResult.status });
  if (analysisResult.status === "fulfilled") analysis = analysisResult.value;
  else {
    const error = analysisResult.reason;
    console.error("Gemini report analysis failed", { reportId, error });
    const detail = error as { status?: number; statusCode?: number; message?: string };
    const status = detail.status || detail.statusCode;
    const messageText = (detail.message || "").toLowerCase();
    const reason = status === 429 || messageText.includes("quota") || messageText.includes("resource_exhausted")
      ? "Gemini is rate-limiting analysis right now. Please retry in a minute."
      : status === 401 || status === 403 || messageText.includes("api key")
        ? "Gemini rejected the configured API key or project access. Check the server key and API access."
        : error instanceof Error && error.name === "ZodError"
          ? "Gemini returned a result that did not match the expected report format. An administrator can retry."
          : "Bilingual analysis could not be completed. Check the server log for the provider error; an administrator can retry.";
    analysisError = analysisError ? `${analysisError} ${reason}` : reason;
  }
  if (embeddingResult.status === "fulfilled") {
    embeddingValues = embeddingResult.value;
    const embeddingSaveStartedAt = Date.now();
    try { await saveEmbedding(admin, reportId, embeddingValues); }
    catch (error) {
      console.error("Gemini report embedding could not be saved", { reportId, durationMs: Date.now() - embeddingSaveStartedAt, error });
      embeddingValues = null;
      const message = "Cross-language matching could not be completed. An administrator can retry.";
      analysisError = analysisError ? `${analysisError}; ${message}` : message;
    }
  } else {
    console.error("Gemini report embedding failed", { reportId, error: embeddingResult.reason });
    const message = "Cross-language matching could not be completed. An administrator can retry.";
    analysisError = analysisError ? `${analysisError}; ${message}` : message;
  }
  const updates: Record<string, unknown> = {
    analysis_status: analysis ? "complete" : "failed",
    analysis_error: analysisError || (analysis ? null : "Analysis did not finish."),
  };
  if (analysis) {
    const suggestedDepartment = normalizeDepartment(analysis.department);
    // AI classification and operational assignment share the canonical department
    // vocabulary. Staff can be added to the department later from Team access.
    const routedDepartment = normalizeDepartment(row.assigned_department) || suggestedDepartment;
    Object.assign(updates, {
    original_language: analysis.detectedLanguage, category: options.categoryOverride || analysis.category,
    suggested_priority: analysis.priority, priority_explanation: analysis.priorityExplanation,
    title_en: analysis.titleEn, title_as: analysis.titleAs,
    summary_en: analysis.summaryEn, summary_as: analysis.summaryAs,
    department: suggestedDepartment || analysis.department, assigned_department: routedDepartment,
    sensitive_flag: analysis.sensitive,
    analysis_confidence: analysis.confidence,
    });
    console.info("Report department routing resolved", { reportId, suggestedDepartment: suggestedDepartment || analysis.department, assignedDepartment: routedDepartment, matchedStaffDepartment: Boolean(routedDepartment) });
  }
  const { error: updateError } = await admin.from("reports").update(updates).eq("id", reportId);
  if (updateError) throw updateError;
  
  const { data: updated } = await admin.from("reports").select("*").eq("id", reportId).single();
  const report = updated ? (await loadReports(admin, [updated]))[0] : null;
  let matches: SimilarReport[] = [];
  if (embeddingValues) {
    const matchStartedAt = Date.now();
    const { data: similarRows, error: similarError } = await admin.rpc("match_reports", {
      p_query_embedding: `[${embeddingValues.join(",")}]`, p_exclude_report_id: reportId,
      p_location_building: row.location_building, p_threshold: Number(process.env.SIMILARITY_THRESHOLD || "0.82"), p_match_count: 3,
    });
    console.info("Report similarity search finished", { reportId, durationMs: Date.now() - matchStartedAt, resultCount: similarRows?.length || 0, failed: Boolean(similarError) });
    if (!similarError) matches = await buildSimilarReports(admin, similarRows || [], {
      language: analysis?.detectedLanguage || row.original_language,
      building: row.location_building,
      area: row.location_area || "",
      category: analysis?.category || row.category,
      createdAt: row.created_at,
    }, isAdmin);
  }
  return { report, matches, analysisError };
}

export async function appendEvent(admin: SupabaseClient, event: { reportId: string; actorId: string; actorName: string; oldStatus?: string | null; newStatus?: string | null; message: string }) {
  const { error } = await admin.from("report_events").insert({ report_id: event.reportId, actor_id: event.actorId, actor_name: event.actorName, old_status: event.oldStatus || null, new_status: event.newStatus || null, message: event.message });
  if (error) throw error;
}
