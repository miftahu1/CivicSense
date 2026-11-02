import { createServiceClient } from "@/lib/supabase/server";
import { isPublicIssueBoardEnabled } from "@/lib/public-issues";

export async function GET(_request: Request, context: { params: Promise<{ ticketNumber: string }> }) {
  try {
    const admin = createServiceClient();
    if (!await isPublicIssueBoardEnabled(admin)) return Response.json({ error: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    const { ticketNumber } = await context.params;
    const { data: report, error } = await admin.from("public_issue_feed").select("id,ticket_number,title_en,title_as,summary_en,summary_as,category,priority,building,area,status,created_at,updated_at").eq("ticket_number", ticketNumber).maybeSingle();
    if (error) throw error;
    if (!report) return Response.json({ error: "Report not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    const { data: eventRows, error: eventsError } = await admin.from("report_events").select("new_status,created_at").eq("report_id", report.id).not("new_status", "is", null).order("created_at", { ascending: true });
    if (eventsError) throw eventsError;
    return Response.json({ report: {
      ticketNumber: report.ticket_number,
      titleEn: report.title_en || `Campus issue ${report.ticket_number}`,
      titleAs: report.title_as || `কেম্পাছৰ সমস্যা ${report.ticket_number}`,
      summaryEn: report.summary_en || "A campus issue has been reported. The bilingual summary is being prepared.",
      summaryAs: report.summary_as || "কেম্পাছৰ এটা সমস্যাৰ প্ৰতিবেদন দিয়া হৈছে। দ্বিভাষিক সাৰাংশ প্ৰস্তুত কৰা হৈছে।",
      category: report.category, priority: report.priority, building: report.building, area: report.area,
      status: report.status, createdAt: report.created_at, updatedAt: report.updated_at,
      updates: (eventRows || []).map((event) => ({ status: event.new_status, createdAt: event.created_at })),
    } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Public issue detail could not be loaded", error);
    return Response.json({ error: "Public report details are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
