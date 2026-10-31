import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeReport, embedReport } from "@/lib/ai";
import { loadReports, mapReport } from "@/lib/db-mappers";
import type { Language, Report, SimilarReport } from "@/lib/types";

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

export async function buildSimilarReports(admin: SupabaseClient, values: Array<{ report_id: string; similarity: number; location_match: boolean }>, source: { language: Language }, isAdmin: boolean): Promise<SimilarReport[]> {
  if (!values.length) return [];
  const { data, error } = await admin.from("reports").select("*").in("id", values.map((value) => value.report_id)).eq("is_synthetic", false).neq("status", "Resolved");
  if (error || !data?.length) return [];
  const mapped = await loadReports(admin, data);
  const byId = new Map(mapped.map((report) => [report.id, report]));
  return values.flatMap((value) => {
    const report = byId.get(value.report_id);
    if (!report) return [];
    const languageDiffers = source.language !== report.originalLanguage;
    const explanationAs = value.location_match
      ? languageDiffers ? "দুয়োটা প্ৰতিবেদনৰ ভাষা পৃথক, কিন্তু অৰ্থৰ ফালৰ পৰা মিল আছে আৰু একেটা ভৱনৰ সৈতে জড়িত।" : "দুয়োটা প্ৰতিবেদন অৰ্থৰ ফালৰ পৰা মিল আছে আৰু একেটা ভৱনৰ সৈতে জড়িত।"
      : languageDiffers ? "বিভিন্ন ভাষাত লিখা বৰ্ণনাসমূহ অৰ্থৰ ফালৰ পৰা মিল আছে; স্থান বেলেগ হোৱাত দুয়োটা পৰ্যালোচনা কৰক।" : "বৰ্ণনাসমূহ অৰ্থৰ ফালৰ পৰা মিল আছে; একেলগ কৰাৰ আগতে স্থান পৰ্যালোচনা কৰক।";
    const explanation = value.location_match
      ? languageDiffers ? "The descriptions are semantically similar across languages and refer to the same campus building." : "The descriptions are semantically similar and refer to the same campus building."
      : languageDiffers ? "The descriptions are semantically similar across languages; the location is different, so please review both reports." : "The descriptions are semantically similar; please review the locations before grouping.";
    const safeReport = isAdmin ? report : { ...report, reporterName: "Campus community member", reporterId: "", originalText: "", imageUrl: undefined, imageCaption: undefined, events: [] };
    return [{ report: safeReport, score: Number(value.similarity), explanation, explanationAs }];
  });
}

export async function processSavedReport(admin: SupabaseClient, reportId: string, isAdmin = true) {
  const row = await getReportRow(admin, reportId);
  if (!row) throw new Error("Report not found.");
  let image: { mimeType: string; bytes: Buffer } | undefined;
  let analysisError: string | null = null;
  const { data: attachment } = await admin.from("attachments").select("storage_path,mime_type,image_caption").eq("report_id", reportId).maybeSingle();
  if (attachment) {
    const { data: downloaded, error } = await admin.storage.from("report-attachments").download(attachment.storage_path);
    if (error) { console.error("Report attachment could not be downloaded", error); analysisError = "The attached photo could not be read; the original text will still be analyzed."; }
    else image = { mimeType: attachment.mime_type, bytes: Buffer.from(await downloaded.arrayBuffer()) };
  }
  let analysis: Awaited<ReturnType<typeof analyzeReport>> | null = null;
  let embeddingValues: number[] | null = null;
  try { analysis = await analyzeReport({ text: row.original_text, language: row.original_language, building: row.location_building, area: row.location_area || "", image }); }
  catch (error) { console.error("Gemini report analysis failed", error); const message = "Bilingual analysis could not be completed. An administrator can retry."; analysisError = analysisError ? `${analysisError} ${message}` : message; }
  try {
    embeddingValues = await embedReport(row.original_text, row.location_building, row.location_area || "");
    await saveEmbedding(admin, reportId, embeddingValues);
  } catch (error) {
    console.error("Gemini report embedding failed", error);
    const message = "Cross-language matching could not be completed. An administrator can retry.";
    analysisError = analysisError ? `${analysisError}; ${message}` : message;
  }
  const updates: Record<string, unknown> = {
    analysis_status: analysis && embeddingValues ? "complete" : "failed",
    analysis_error: analysis && embeddingValues ? analysisError : analysisError || "Analysis did not finish.",
  };
  if (analysis) Object.assign(updates, {
    original_language: analysis.detectedLanguage, category: analysis.category,
    suggested_priority: analysis.priority, priority_explanation: analysis.priorityExplanation,
    title_en: analysis.titleEn, title_as: analysis.titleAs,
    summary_en: analysis.summaryEn, summary_as: analysis.summaryAs,
    department: analysis.department, sensitive_flag: analysis.sensitive,
    analysis_confidence: analysis.confidence,
  });
  const { error: updateError } = await admin.from("reports").update(updates).eq("id", reportId);
  if (updateError) throw updateError;
  if (analysis && attachment) {
    const { error: captionError } = await admin.from("attachments").update({ image_caption: analysis.imageDescription || null }).eq("report_id", reportId);
    if (captionError) console.error("Attachment caption update failed", captionError.message);
  }
  const { data: updated } = await admin.from("reports").select("*").eq("id", reportId).single();
  const report = updated ? (await loadReports(admin, [updated]))[0] : null;
  let matches: SimilarReport[] = [];
  if (embeddingValues) {
    const { data: similarRows, error: similarError } = await admin.rpc("match_reports", {
      p_query_embedding: `[${embeddingValues.join(",")}]`, p_exclude_report_id: reportId,
      p_location_building: row.location_building, p_threshold: Number(process.env.SIMILARITY_THRESHOLD || "0.82"), p_match_count: 3,
    });
    if (!similarError) matches = await buildSimilarReports(admin, similarRows || [], { language: analysis?.detectedLanguage || row.original_language }, isAdmin);
  }
  return { report, matches, analysisError };
}

export async function appendEvent(admin: SupabaseClient, event: { reportId: string; actorId: string; actorName: string; oldStatus?: string | null; newStatus?: string | null; message: string }) {
  const { error } = await admin.from("report_events").insert({ report_id: event.reportId, actor_id: event.actorId, actor_name: event.actorName, old_status: event.oldStatus || null, new_status: event.newStatus || null, message: event.message });
  if (error) throw error;
}
