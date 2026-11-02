import { clusterInputSchema } from "@/lib/schemas";
import { authErrorResponse, requireAdmin } from "@/lib/supabase/server";
import { appendEvent } from "@/lib/report-service";
import { mapCluster, mapReport } from "@/lib/db-mappers";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireAdmin();
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");
    const offset = (page - 1) * pageSize;

    const [{ data: clusters, error, count }, { data: reports, error: reportsError }] = await Promise.all([
      admin.from("issue_clusters").select("*", { count: "exact" }).eq("is_synthetic", false).order("created_at", { ascending: false }).range(offset, offset + pageSize - 1),
      admin.from("reports").select("*").eq("is_synthetic", false).not("cluster_id", "is", null).order("created_at", { ascending: false }),
    ]);
    if (error) throw error;
    if (reportsError) throw reportsError;
    const idsByCluster = new Map<string, string[]>();
    const departmentsByCluster = new Map<string, Set<string>>();
    const reportsByCluster = new Map<string, ReturnType<typeof mapReport>[]>();
    (reports || []).forEach((report) => {
      if (!report.cluster_id) return;
      const list = idsByCluster.get(report.cluster_id) || [];
      list.push(report.id);
      idsByCluster.set(report.cluster_id, list);
      const memberReports = reportsByCluster.get(report.cluster_id) || [];
      memberReports.push(mapReport(report));
      reportsByCluster.set(report.cluster_id, memberReports);
      if (report.assigned_department) {
        const departments = departmentsByCluster.get(report.cluster_id) || new Set<string>();
        departments.add(report.assigned_department);
        departmentsByCluster.set(report.cluster_id, departments);
      }
    });
    return Response.json({ clusters: (clusters || []).map((cluster) => {
      const departments = departmentsByCluster.get(cluster.id);
      return mapCluster(cluster, idsByCluster.get(cluster.id) || [], departments?.size === 1 ? [...departments][0] : null, reportsByCluster.get(cluster.id) || []);
    }), count: count || 0 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { admin, user, profile } = await requireAdmin();
    const parsed = clusterInputSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Invalid cluster details." }, { status: 400 });
    const ids = [...new Set(parsed.data.reportIds)];
    if (ids.length < 2) return Response.json({ error: "Select at least two separate reports." }, { status: 400 });
    const { data: reports, error: reportError } = await admin.from("reports").select("id,cluster_id,category,location_building,status").eq("is_synthetic", false).in("id", ids);
    if (reportError) throw reportError;
    if (!reports || reports.length !== ids.length) return Response.json({ error: "One or more reports could not be found." }, { status: 404 });
    if (reports.some((report) => report.cluster_id)) return Response.json({ error: "Separate reports from their current cluster before grouping them again." }, { status: 409 });
    if (reports.some((report) => report.status === "Resolved")) return Response.json({ error: "Resolved reports cannot be added to an active issue cluster." }, { status: 409 });
    const categoryCounts = new Map<string, number>();
    reports.forEach((report) => categoryCounts.set(report.category, (categoryCounts.get(report.category) || 0) + 1));
    const category = [...categoryCounts].sort((a, b) => b[1] - a[1])[0][0];
    const buildings = [...new Set(reports.map((report) => report.location_building))];
    const location = buildings.length === 1 ? buildings[0] : "Multiple campus locations";
    const statusRank: Record<string, number> = { "Under review": 0, Investigating: 1, "In progress": 2, "Awaiting admin review": 3 };
    const status = reports.reduce((mostAdvanced, report) => statusRank[report.status] > statusRank[mostAdvanced] ? report.status : mostAdvanced, "Under review");
    const { data: cluster, error: clusterError } = await admin.from("issue_clusters").insert({ title: parsed.data.title, category, location, status, assigned_to_name: parsed.data.assignedTo || null, created_by: user.id }).select("id").single();
    if (clusterError || !cluster) throw clusterError || new Error("Could not create the cluster.");
    const { error: updateError } = await admin.from("reports").update({ cluster_id: cluster.id, status, ...(parsed.data.assignedTo ? { assigned_to_name: parsed.data.assignedTo } : {}) }).in("id", ids);
    if (updateError) { await admin.from("issue_clusters").delete().eq("id", cluster.id); throw updateError; }
    await Promise.all(reports.map((report) => appendEvent(admin, {
      reportId: report.id,
      actorId: user.id,
      actorName: profile.full_name,
      oldStatus: report.status === status ? null : report.status,
      newStatus: report.status === status ? null : status,
      message: `Grouped under “${parsed.data.title}” after administrator confirmation.${report.status === status ? "" : ` Cluster progress aligned to ${status}.`}`,
    })));
    return Response.json({ clusterId: cluster.id, ok: true }, { status: 201 });
  } catch (error) { return authErrorResponse(error); }
}
