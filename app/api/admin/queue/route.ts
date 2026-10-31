import { loadReports } from "@/lib/db-mappers";
import { authErrorResponse, requireAdmin } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { admin } = await requireAdmin();
    const { data, error } = await admin.from("reports").select("*").eq("is_synthetic", false).order("created_at", { ascending: false }).limit(1000);
    if (error) throw error;
    return Response.json({ reports: await loadReports(admin, data || []) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}
