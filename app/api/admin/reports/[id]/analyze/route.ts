import { authErrorResponse, requireAdmin } from "@/lib/supabase/server";
import { getReportRow, processSavedReport } from "@/lib/report-service";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { admin } = await requireAdmin();
    const row = await getReportRow(admin, id);
    if (!row) return Response.json({ error: "Report not found." }, { status: 404 });
    const result = await processSavedReport(admin, id, true);
    return Response.json({ report: result.report, matches: result.matches, analysisError: result.analysisError }, { status: result.report?.analysisStatus === "complete" ? 200 : 422 });
  } catch (error) { return authErrorResponse(error); }
}
