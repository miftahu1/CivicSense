import { authErrorResponse, requireStaff } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { admin, profile } = await requireStaff();
    const { data: memberReports, error: reportError } = await admin.from("reports")
      .select("id,cluster_id,ticket_number,title_en,title_as,summary_en,summary_as,category,suggested_priority,confirmed_priority,status,location_building,location_area,updated_at")
      .eq("is_synthetic", false).eq("assigned_department", profile.department).not("cluster_id", "is", null).neq("status", "Resolved")
      .order("updated_at", { ascending: false }).limit(500);
    if (reportError) throw reportError;
    const grouped = new Map<string, typeof memberReports>();
    (memberReports || []).forEach((report) => {
      if (!report.cluster_id) return;
      grouped.set(report.cluster_id, [...(grouped.get(report.cluster_id) || []), report]);
    });
    const clusterIds = [...grouped.keys()];
    if (!clusterIds.length) return Response.json({ clusters: [] }, { headers: { "Cache-Control": "private, no-store" } });
    const { data: clusters, error: clusterError } = await admin.from("issue_clusters").select("id,title,category,location,status,created_at")
      .in("id", clusterIds).eq("is_synthetic", false).order("updated_at", { ascending: false });
    if (clusterError) throw clusterError;
    const rows = (clusters || []).map((cluster) => ({ ...cluster, reports: grouped.get(cluster.id) || [] }))
      .filter((cluster) => cluster.reports.length > 1);
    return Response.json({ clusters: rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}
