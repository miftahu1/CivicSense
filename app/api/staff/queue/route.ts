import { loadReports } from "@/lib/db-mappers";
import { authErrorResponse, requireStaff } from "@/lib/supabase/server";
import { normalizeDepartment } from "@/lib/departments";

export async function GET() {
  try {
    const { admin, profile } = await requireStaff();
    const { data, error } = await admin.from("reports").select("*")
      .eq("is_synthetic", false)
      .not("assigned_department", "is", null)
      .neq("status", "Resolved")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    const departmentReports = (data || []).filter((report) => normalizeDepartment(report.assigned_department) === profile.department);
    return Response.json({ reports: await loadReports(admin, departmentReports) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}
