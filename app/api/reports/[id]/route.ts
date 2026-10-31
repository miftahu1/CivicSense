import { loadReports } from "@/lib/db-mappers";
import { authErrorResponse, requireUser } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { admin, profile } = await requireUser();
    const { data: row, error } = await admin.from("reports").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!row || (profile.role !== "admin" && row.reporter_id !== profile.id)) return Response.json({ error: "Report not found." }, { status: 404 });
    const [report] = await loadReports(admin, [row]);
    return Response.json({ report }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}
