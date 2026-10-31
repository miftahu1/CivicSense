import { z } from "zod";
import { appendEvent } from "@/lib/report-service";
import { authErrorResponse, requireStaff } from "@/lib/supabase/server";

const staffUpdateSchema = z.object({
  status: z.enum(["Investigating", "In progress", "Awaiting admin review"]),
  message: z.string().trim().min(3).max(1000),
}).strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { admin, user, profile } = await requireStaff();
    const parsed = staffUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Add a status and work note." }, { status: 400 });

    const { data: report, error: reportError } = await admin.from("reports").select("id,status,assigned_department")
      .eq("is_synthetic", false)
      .eq("id", id).eq("assigned_department", profile.department).maybeSingle();
    if (reportError) throw reportError;
    if (!report) return Response.json({ error: "This report is not assigned to your department." }, { status: 404 });

    const { status, message } = parsed.data;
    if (report.status === "Resolved" || report.status === "Awaiting admin review") {
      return Response.json({ error: "This report is locked while it is resolved or waiting for administrator review." }, { status: 409 });
    }
    if (status === "Investigating" && !["Under review", "Investigating"].includes(report.status)) {
      return Response.json({ error: "A report already in progress cannot be moved back to investigation." }, { status: 409 });
    }
    if (status === "In progress" && !["Investigating", "In progress"].includes(report.status)) {
      return Response.json({ error: "Move the report to Investigating before starting work." }, { status: 409 });
    }
    if (status === "Awaiting admin review" && report.status !== "In progress") {
      return Response.json({ error: "Move the report to In progress before requesting administrator review." }, { status: 409 });
    }

    const { error: updateError } = await admin.from("reports").update({ status }).eq("id", id);
    if (updateError) throw updateError;
    await appendEvent(admin, {
      reportId: id,
      actorId: user.id,
      actorName: profile.full_name,
      oldStatus: status === report.status ? null : report.status,
      newStatus: status === report.status ? null : status,
      message,
    });
    return Response.json({ ok: true });
  } catch (error) { return authErrorResponse(error); }
}
