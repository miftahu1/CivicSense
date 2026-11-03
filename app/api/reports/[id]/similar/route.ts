import { buildSimilarReports, getReportRow, saveEmbedding } from "@/lib/report-service";
import { embedReport } from "@/lib/ai";
import { mapReport } from "@/lib/db-mappers";
import { authErrorResponse, requireUser } from "@/lib/supabase/server";
import { normalizeDepartment } from "@/lib/departments";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { admin, profile } = await requireUser();
    const row = await getReportRow(admin, id);
    if (!row) return Response.json({ error: "Report not found." }, { status: 404 });
    const isAdmin = profile.role === "admin";
    const isAssignedStaff = profile.role === "staff" && Boolean(profile.department) && normalizeDepartment(row.assigned_department) === normalizeDepartment(profile.department);
    if (!isAdmin && !isAssignedStaff && row.reporter_id !== profile.id) return Response.json({ error: "Report not found." }, { status: 404 });

    if (isAdmin) {
      const { data: saved, error: savedError } = await admin.from("report_embeddings").select("embedding").eq("report_id", id).maybeSingle();
      if (savedError) throw savedError;
      let embedding = typeof saved?.embedding === "string" ? saved.embedding : null;
      if (!embedding) {
        const values = await embedReport(row.original_text, row.location_building, row.location_area || "");
        await saveEmbedding(admin, id, values);
        embedding = `[${values.join(",")}]`;
      }
      const { data, error } = await admin.rpc("match_reports", { p_query_embedding: embedding, p_exclude_report_id: id, p_location_building: row.location_building, p_threshold: Number(process.env.SIMILARITY_THRESHOLD || "0.82"), p_match_count: 10 });
      if (error) throw error;
      const matches = await buildSimilarReports(admin, data || [], { language: row.original_language, building: row.location_building, area: row.location_area || "", category: row.category, createdAt: row.created_at }, true);
      return Response.json({ matches, cluster: null }, { headers: { "Cache-Control": "private, no-store" } });
    }

    // Students and staff only see relationships explicitly confirmed by an administrator.
    if (!row.cluster_id) return Response.json({ matches: [], cluster: null }, { headers: { "Cache-Control": "private, no-store" } });
    const [{ data: cluster, error: clusterError }, { data: members, error: membersError }] = await Promise.all([
      admin.from("issue_clusters").select("id,title,category,location,status,created_at").eq("id", row.cluster_id).maybeSingle(),
      admin.from("reports").select("*").eq("cluster_id", row.cluster_id).eq("is_synthetic", false).neq("status", "Resolved").neq("sensitive_flag", true).order("created_at", { ascending: false }),
    ]);
    if (clusterError) throw clusterError;
    if (membersError) throw membersError;
    const authorizedMembers = (members || []).filter((member) => member.id !== id && (isAssignedStaff
      ? normalizeDepartment(member.assigned_department) === normalizeDepartment(profile.department)
      : !member.public_opt_out));
    const matches = authorizedMembers.map((member) => {
      const report = mapReport(member);
      const privacySafeReport = isAssignedStaff ? {
        ...report, reporterName: "Campus community member", reporterId: "", originalText: "", imageUrl: undefined, imageCaption: undefined, events: [],
      } : {
        ...report, reporterName: "Campus community", reporterId: "", originalText: "", summaryEn: report.summaryEn.slice(0, 220), summaryAs: report.summaryAs.slice(0, 220),
        area: "", assignedTo: null, assignedDepartment: null, department: "", imageUrl: undefined, imageCaption: undefined, events: [],
      };
      return {
        report: privacySafeReport,
        score: 1,
        explanation: "An administrator confirmed this report belongs to the same issue cluster.",
        explanationAs: "প্ৰশাসকে এই প্ৰতিবেদনটো একেটা সমস্যা ক্লাষ্টাৰৰ বুলি নিশ্চিত কৰিছে।",
      };
    });
    return Response.json({ matches, cluster: cluster ? { ...cluster, reportIds: (members || []).map((member) => member.id) } : null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}
