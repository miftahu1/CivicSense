import { updateReportSchema } from "@/lib/schemas";
import { authErrorResponse, requireAdmin } from "@/lib/supabase/server";
import { appendEvent } from "@/lib/report-service";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { admin, user, profile } = await requireAdmin();
    const parsed = updateReportSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Invalid report update." }, { status: 400 });
    const { data: before, error: loadError } = await admin.from("reports").select("id,status,category,suggested_priority,confirmed_priority,assigned_department,assigned_to_name").eq("id", id).eq("is_synthetic", false).maybeSingle();
    if (loadError) throw loadError;
    if (!before) return Response.json({ error: "Report not found." }, { status: 404 });
    const input = parsed.data;
    if (before.status === "Awaiting admin review" && input.status === "In progress" && !input.message?.trim()) {
      return Response.json({ error: "Add a review note before returning this report to staff." }, { status: 400 });
    }
    const patch: Record<string, unknown> = {};
    if (input.status) patch.status = input.status;
    if (input.category) patch.category = input.category;
    if (input.confirmedPriority !== undefined) patch.confirmed_priority = input.confirmedPriority;
    if (input.assignedTo !== undefined) patch.assigned_to_name = input.assignedTo;
    if (input.assignedDepartment !== undefined) patch.assigned_department = input.assignedDepartment;
    const { error: updateError } = await admin.from("reports").update(patch).eq("id", id);
    if (updateError) throw updateError;
    if (input.message || input.status && input.status !== before.status || input.category && input.category !== before.category || input.confirmedPriority !== undefined && input.confirmedPriority !== before.confirmed_priority || input.assignedTo !== undefined && input.assignedTo !== before.assigned_to_name || input.assignedDepartment !== undefined && input.assignedDepartment !== before.assigned_department) {
      const changes = [input.status && input.status !== before.status ? `Status changed to ${input.status}.` : "", input.category && input.category !== before.category ? `Category set to ${input.category}.` : "", input.confirmedPriority !== undefined && input.confirmedPriority !== before.confirmed_priority ? `Priority confirmed as ${input.confirmedPriority || "the AI suggestion"}.` : "", input.assignedTo !== undefined && input.assignedTo !== before.assigned_to_name ? `Assigned to ${input.assignedTo || "no team"}.` : "", input.assignedDepartment !== undefined && input.assignedDepartment !== before.assigned_department ? `Department assigned to ${input.assignedDepartment || "no department"}.` : ""] .filter(Boolean).join(" ");
      await appendEvent(admin, { reportId: id, actorId: user.id, actorName: profile.full_name, oldStatus: input.status && input.status !== before.status ? before.status : null, newStatus: input.status && input.status !== before.status ? input.status : null, message: input.message || changes || "Report classification updated." });
    }
    return Response.json({ ok: true });
  } catch (error) { return authErrorResponse(error); }
}
