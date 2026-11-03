import { authErrorResponse, requireAdmin } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { admin } = await requireAdmin();
    const [reportsResult, clusterResult, eventsResult] = await Promise.all([
      admin.from("reports").select("id,status,category,original_language,suggested_priority,confirmed_priority,created_at,assigned_department").eq("is_synthetic", false),
      admin.from("issue_clusters").select("id,status,created_at").eq("is_synthetic", false).order("created_at", { ascending: false }).limit(8),
      admin.from("report_events").select("id,message,created_at,report_id").order("created_at", { ascending: false }).limit(10),
    ]);
    if (reportsResult.error) throw reportsResult.error;
    if (clusterResult.error) throw clusterResult.error;
    if (eventsResult.error) throw eventsResult.error;
    const reports = reportsResult.data || [];
    const clusters = clusterResult.data || [];
    const liveReportIds = new Set(reports.map((row) => row.id));
    const events = (eventsResult.data || []).filter((event) => liveReportIds.has(event.report_id));
    const count = (predicate: (row: (typeof reports)[number]) => boolean) => reports.filter(predicate).length;
    const now = Date.now();
    const openReports = reports.filter((row) => row.status !== "Resolved");
    const ageHours = (row: (typeof reports)[number]) => Math.max(0, (now - Date.parse(row.created_at)) / 3_600_000);
    const backlog = {
      underOneDay: openReports.filter((row) => ageHours(row) < 24).length,
      oneToThreeDays: openReports.filter((row) => ageHours(row) >= 24 && ageHours(row) < 72).length,
      threeToSevenDays: openReports.filter((row) => ageHours(row) >= 72 && ageHours(row) < 168).length,
      overSevenDays: openReports.filter((row) => ageHours(row) >= 168).length,
      unassigned: openReports.filter((row) => !row.assigned_department).length,
      urgentOlderThanThreeDays: openReports.filter((row) => (row.confirmed_priority || row.suggested_priority) === "Urgent" && ageHours(row) >= 72).length,
      averageOpenAgeDays: openReports.length ? Number((openReports.reduce((sum, row) => sum + ageHours(row) / 24, 0) / openReports.length).toFixed(1)) : 0,
    };
    const categories = Object.entries(reports.reduce<Record<string, number>>((acc, row) => { acc[row.category] = (acc[row.category] || 0) + 1; return acc; }, {})).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
    const priorities = ["Urgent", "High", "Medium", "Low"].map((priority) => ({ priority, total: reports.filter((row) => (row.confirmed_priority || row.suggested_priority) === priority && row.status !== "Resolved").length }));
    const languages = ["Assamese", "Romanised Assamese", "English", "Mixed"].map((language) => ({ language, total: reports.filter((row) => row.original_language === language).length }));
    return Response.json({ active: count((row) => row.status !== "Resolved"), pendingReview: count((row) => row.status === "Under review"), awaitingAdminReview: count((row) => row.status === "Awaiting admin review"), investigating: count((row) => row.status === "Investigating"), inProgress: count((row) => row.status === "In progress" || row.status === "Investigating"), resolved: count((row) => row.status === "Resolved"), categories, priorities, languages, clusters, events, backlog }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}
