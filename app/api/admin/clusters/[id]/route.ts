import { z } from "zod";
import { authErrorResponse, requireAdmin } from "@/lib/supabase/server";
import { appendEvent } from "@/lib/report-service";

const clusterUpdateSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  status: z.enum(["Under review", "Investigating", "In progress", "Resolved"]).optional(),
  assignedTo: z.string().trim().max(120).nullable().optional(),
  message: z.string().trim().max(1000).optional(),
  action: z.enum(["separate"]).optional(),
  reportId: z.string().uuid().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { admin, user, profile } = await requireAdmin();
    const parsed = clusterUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Invalid cluster update." }, { status: 400 });
    const input = parsed.data;
    const { data: cluster, error: clusterError } = await admin.from("issue_clusters").select("id,title,status,assigned_to_name").eq("id", id).maybeSingle();
    if (clusterError) throw clusterError;
    if (!cluster) return Response.json({ error: "Cluster not found." }, { status: 404 });
    if (input.action === "separate") {
      if (!input.reportId) return Response.json({ error: "Select a report to separate." }, { status: 400 });
      const { data: report, error: reportError } = await admin.from("reports").select("id,cluster_id,status").eq("id", input.reportId).maybeSingle();
      if (reportError) throw reportError;
      if (!report || report.cluster_id !== id) return Response.json({ error: "That report is not in this cluster." }, { status: 404 });
      const { error: separateError } = await admin.from("reports").update({ cluster_id: null }).eq("id", input.reportId);
      if (separateError) throw separateError;
      await appendEvent(admin, { reportId: input.reportId, actorId: user.id, actorName: profile.full_name, message: `Separated from “${cluster.title}” after administrator review.` });
      const { data: remaining, error: remainingError } = await admin.from("reports").select("id").eq("cluster_id", id);
      if (remainingError) throw remainingError;
      if ((remaining || []).length < 2) {
        const { error: clearError } = await admin.from("reports").update({ cluster_id: null }).eq("cluster_id", id);
        if (clearError) throw clearError;
        const { error: deleteError } = await admin.from("issue_clusters").delete().eq("id", id);
        if (deleteError) throw deleteError;
      }
      return Response.json({ ok: true });
    }
    const updates: Record<string, unknown> = {};
    if (input.title) updates.title = input.title;
    if (input.status) updates.status = input.status;
    if (input.assignedTo !== undefined) updates.assigned_to_name = input.assignedTo;
    if (!Object.keys(updates).length) return Response.json({ error: "No cluster changes were provided." }, { status: 400 });
    const { error: updateError } = await admin.from("issue_clusters").update(updates).eq("id", id);
    if (updateError) throw updateError;
    const reportUpdates: Record<string, unknown> = {};
    if (input.status) reportUpdates.status = input.status;
    if (input.assignedTo !== undefined) reportUpdates.assigned_to_name = input.assignedTo;
    if (Object.keys(reportUpdates).length) {
      const { data: members, error: memberError } = await admin.from("reports").select("id,status").eq("cluster_id", id);
      if (memberError) throw memberError;
      const { error } = await admin.from("reports").update(reportUpdates).eq("cluster_id", id);
      if (error) throw error;
      if (input.status && input.status !== cluster.status) await Promise.all((members || []).map((member) => appendEvent(admin, { reportId: member.id, actorId: user.id, actorName: profile.full_name, oldStatus: member.status, newStatus: input.status, message: input.message || `Issue cluster “${input.title || cluster.title}” moved to ${input.status}.` })));
    }
    return Response.json({ ok: true });
  } catch (error) { return authErrorResponse(error); }
}
