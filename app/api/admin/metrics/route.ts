import { authErrorResponse, requireAdmin } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { admin } = await requireAdmin();
    const [reportsResult, clusterResult, eventsResult] = await Promise.all([
      admin.from("reports").select("status,category,original_language,suggested_priority,confirmed_priority,created_at"),
      admin.from("issue_clusters").select("id,status,created_at").order("created_at", { ascending: false }).limit(8),
      admin.from("report_events").select("id,message,created_at,report_id").order("created_at", { ascending: false }).limit(10),
    ]);
    if (reportsResult.error) throw reportsResult.error;
    if (clusterResult.error) throw clusterResult.error;
    if (eventsResult.error) throw eventsResult.error;
    const reports = reportsResult.data || [];
    const clusters = clusterResult.data || [];
    const events = eventsResult.data || [];
    const count = (predicate: (row: (typeof reports)[number]) => boolean) => reports.filter(predicate).length;
    const categories = Object.entries(reports.reduce<Record<string, number>>((acc, row) => { acc[row.category] = (acc[row.category] || 0) + 1; return acc; }, {})).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
    const priorities = ["Urgent", "High", "Medium", "Low"].map((priority) => ({ priority, total: reports.filter((row) => (row.confirmed_priority || row.suggested_priority) === priority && row.status !== "Resolved").length }));
    const languages = ["Assamese", "Romanised Assamese", "English", "Mixed"].map((language) => ({ language, total: reports.filter((row) => row.original_language === language).length }));
    return Response.json({ active: count((row) => row.status !== "Resolved"), pendingReview: count((row) => row.status === "Under review"), investigating: count((row) => row.status === "Investigating"), inProgress: count((row) => row.status === "In progress" || row.status === "Investigating"), resolved: count((row) => row.status === "Resolved"), categories, priorities, languages, clusters, events }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}
