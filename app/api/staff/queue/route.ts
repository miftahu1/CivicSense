import { loadReports } from "@/lib/db-mappers";
import { authErrorResponse, requireStaff } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { admin, profile } = await requireStaff();
    const { data, error } = await admin.from("reports").select("*")
      .eq("is_synthetic", false)
      .eq("assigned_department", profile.department)
      .neq("status", "Resolved")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return Response.json({ reports: await loadReports(admin, data || []) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}
