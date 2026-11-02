import { mapReport } from "@/lib/db-mappers";
import { authErrorResponse, requireAdmin } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

const PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireAdmin();
    const requestedPage = Number.parseInt(request.nextUrl.searchParams.get("page") || "1", 10);
    const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
    const offset = (page - 1) * PAGE_SIZE;
    const { data, error, count } = await admin
      .from("reports")
      .select("*", { count: "exact" })
      .eq("is_synthetic", false)
      .is("cluster_id", null)
      .neq("status", "Resolved")
      .eq("analysis_status", "complete")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    return Response.json({ reports: (data || []).map((row) => mapReport(row)), count: count || 0, page, pageSize: PAGE_SIZE }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) { return authErrorResponse(error); }
}
