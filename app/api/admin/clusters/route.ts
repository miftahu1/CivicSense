import { clusterInputSchema } from "@/lib/schemas";
import { authErrorResponse, requireAdmin } from "@/lib/supabase/server";
import { appendEvent } from "@/lib/report-service";
import { mapCluster } from "@/lib/db-mappers";

export async function GET() {
  try {
    const { admin } = await requireAdmin();
    const [{ data: clusters, error }, { data: reports, error: reportsError }] = await Promise.all([
      admin.from("issue_clusters").select("*").eq("is_synthetic", false).order("created_at", { ascending: false }),
      admin.from("reports").select("id,cluster_id").eq("is_synthetic", false).not("cluster_id", "is", null),
    ]);
    if (error) throw error;
    if (reportsError) throw reportsError;
    const idsByCluster = new Map<string, string[]>();
    (reports || []).forEach((report) => { const list = idsByCluster.get(report.cluster_id) || []; list.push(report.id); idsByCluster.set(report.cluster_id, list); });
    return Response.json({ clusters: (clusters || []).map((cluster) => mapCluster(cluster, idsByCluster.get(cluster.id) || [])) }, { headers: { "Cache-Control": "private, no-store" } });
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
    const category = reports[0].category;
    const buildings = [...new Set(reports.map((report) => report.location_building))];
    const location = buildings.length === 1 ? buildings[0] : "Multiple campus locations";
    const { data: cluster, error: clusterError } = await admin.from("issue_clusters").insert({ title: parsed.data.title, category, location, status: "Under review", assigned_to_name: parsed.data.assignedTo || null, created_by: user.id }).select("id").single();
    if (clusterError || !cluster) throw clusterError || new Error("Could not create the cluster.");
    const { error: updateError } = await admin.from("reports").update({ cluster_id: cluster.id, ...(parsed.data.assignedTo ? { assigned_to_name: parsed.data.assignedTo } : {}) }).in("id", ids);
    if (updateError) { await admin.from("issue_clusters").delete().eq("id", cluster.id); throw updateError; }
    await Promise.all(ids.map((reportId) => appendEvent(admin, { reportId, actorId: user.id, actorName: profile.full_name, message: `Grouped under “${parsed.data.title}” after administrator confirmation.` })));
    return Response.json({ clusterId: cluster.id, ok: true }, { status: 201 });
  } catch (error) { return authErrorResponse(error); }
}
