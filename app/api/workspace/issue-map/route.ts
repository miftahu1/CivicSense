import { normalizeDepartment } from "@/lib/departments";
import { authErrorResponse, requireUser } from "@/lib/supabase/server";

const PAGE_SIZE = 500;

export async function GET() {
  try {
    const { admin, profile } = await requireUser();
    if (profile.role !== "admin" && profile.role !== "staff") {
      return Response.json({ error: "Administrator or staff access is required." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }

    const reports: Array<Record<string, unknown>> = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await admin.from("reports")
        .select("id,ticket_number,title_en,title_as,category,suggested_priority,confirmed_priority,status,location_building,location_area,location_latitude,location_longitude,assigned_department,is_synthetic")
        .eq("is_synthetic", false)
        .neq("status", "Resolved")
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      const page = data || [];
      reports.push(...page.filter((report) => profile.role === "admin" || (
        Boolean(profile.department) && normalizeDepartment(report.assigned_department) === normalizeDepartment(profile.department)
      )));
      if (page.length < PAGE_SIZE) break;
    }

    const mapReports = reports.map((report) => ({
      id: report.id,
      ticketNumber: report.ticket_number,
      titleEn: report.title_en,
      titleAs: report.title_as,
      category: report.category,
      priority: report.confirmed_priority || report.suggested_priority,
      status: report.status,
      building: report.location_building,
      area: report.location_area || "",
      latitude: report.location_latitude,
      longitude: report.location_longitude,
    }));
    return Response.json({ reports: mapReports }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return authErrorResponse(error);
  }
}
