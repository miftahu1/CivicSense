import { buildSimilarReports, getReportRow, saveEmbedding } from "@/lib/report-service";
import { embedReport } from "@/lib/ai";
import { authErrorResponse, requireUser } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { admin, profile } = await requireUser();
    const row = await getReportRow(admin, id);
    if (!row || (profile.role !== "admin" && row.reporter_id !== profile.id)) return Response.json({ error: "Report not found." }, { status: 404 });
    const { data: saved, error: savedError } = await admin.from("report_embeddings").select("embedding").eq("report_id", id).maybeSingle();
    if (savedError) throw savedError;
    let embedding = typeof saved?.embedding === "string" ? saved.embedding : null;
    if (!embedding) {
      const values = await embedReport(row.original_text, row.location_building, row.location_area || "");
      await saveEmbedding(admin, id, values);
      embedding = `[${values.join(",")}]`;
    }
    const { data, error } = await admin.rpc("match_reports", { p_query_embedding: embedding, p_exclude_report_id: id, p_location_building: row.location_building, p_threshold: Number(process.env.SIMILARITY_THRESHOLD || "0.82"), p_match_count: 3 });
    if (error) throw error;
    const matches = await buildSimilarReports(admin, data || [], { language: row.original_language }, profile.role === "admin");
    return Response.json({ matches }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}
