import { authErrorResponse, requireAdmin } from "@/lib/supabase/server";
import { getReportRow, processSavedReport } from "@/lib/report-service";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { admin } = await requireAdmin();
    const row = await getReportRow(admin, id);
    if (!row) return Response.json({ error: "Report not found." }, { status: 404 });

    // Fire and forget the report processing. Don't await it.
    // The client will get an immediate response.
    processSavedReport(admin, id, true).catch(console.error);

    // Return a 202 Accepted response to indicate the request has been accepted for processing.
    return Response.json({ message: "Analysis has been queued." }, { status: 202 });
  } catch (error) { return authErrorResponse(error); }
}
