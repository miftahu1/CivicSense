import { createServiceClient } from "@/lib/supabase/server";
import { isPublicIssueBoardEnabled } from "@/lib/public-issues";

const PAGE_SIZE = 24;
const allowedStatuses = new Set(["Under review", "Investigating", "In progress", "Awaiting admin review", "Resolved"]);
const allowedPriorities = new Set(["Urgent", "High", "Medium", "Low"]);

export async function GET(request: Request) {
  try {
    const admin = createServiceClient();
    if (!await isPublicIssueBoardEnabled(admin)) return Response.json({ error: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    const { searchParams } = new URL(request.url);
    const requestedPage = Number.parseInt(searchParams.get("page") || "1", 10);
    const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
    const search = (searchParams.get("q") || "").replace(/[^\p{L}\p{N}# -]/gu, " ").trim().slice(0, 80);
    const status = searchParams.get("status") || "";
    const category = searchParams.get("category") || "";
    const priority = searchParams.get("priority") || "";
    const sort = searchParams.get("sort") || "latest";

    let query = admin.from("public_issue_feed").select("*", { count: "exact" });
    if (search) {
      const pattern = `%${search}%`;
      query = query.or(["ticket_number", "title_en", "title_as", "summary_en", "summary_as", "building", "area"].map((field) => `${field}.ilike.${pattern}`).join(","));
    }
    if (allowedStatuses.has(status)) query = query.eq("status", status);
    if (category) query = query.eq("category", category);
    if (allowedPriorities.has(priority)) query = query.eq("priority", priority);
    query = sort === "oldest" ? query.order("created_at", { ascending: true })
      : sort === "priority" ? query.order("priority_rank", { ascending: false }).order("created_at", { ascending: false })
        : query.order("created_at", { ascending: false });
    const [{ data, error, count }, { data: allStats, error: statsError }] = await Promise.all([
      query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
      admin.from("public_issue_feed").select("status,priority"),
    ]);
    if (error) throw error;
    if (statsError) throw statsError;
    const stats = (allStats || []).reduce((result, report) => {
      result.total += 1;
      if (report.status === "Under review") result.underReview += 1;
      if (report.status === "Resolved") result.resolved += 1;
      if (report.priority === "Urgent") result.urgent += 1;
      return result;
    }, { total: 0, underReview: 0, resolved: 0, urgent: 0 });
    const reports = (data || []).map((report) => ({
      ticketNumber: report.ticket_number,
      titleEn: report.title_en || `Campus issue ${report.ticket_number}`,
      titleAs: report.title_as || `কেম্পাছৰ সমস্যা ${report.ticket_number}`,
      summaryEn: report.summary_en || "A campus issue has been reported. The bilingual summary is being prepared.",
      summaryAs: report.summary_as || "কেম্পাছৰ এটা সমস্যাৰ প্ৰতিবেদন দিয়া হৈছে। দ্বিভাষিক সাৰাংশ প্ৰস্তুত কৰা হৈছে।",
      category: report.category,
      priority: report.priority,
      building: report.building,
      area: report.area,
      status: report.status,
      createdAt: report.created_at,
    }));
    return Response.json({ reports, count: count || 0, page, pageSize: PAGE_SIZE, stats }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Public issues could not be loaded", error);
    return Response.json({ error: "Public issues are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
