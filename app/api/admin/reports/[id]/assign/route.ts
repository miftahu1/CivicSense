import { z } from "zod";
import { authErrorResponse, requireAdmin } from "@/lib/supabase/server";
import { appendEvent } from "@/lib/report-service";

const assignmentSchema = z.object({ assignedTo: z.string().trim().max(120).nullable(), message: z.string().trim().max(1000).optional() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { admin, user, profile } = await requireAdmin();
    const parsed = assignmentSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Provide a team name or null to unassign." }, { status: 400 });
    const { data: report, error: loadError } = await admin.from("reports").select("id").eq("id", id).eq("is_synthetic", false).maybeSingle();
    if (loadError) throw loadError;
    if (!report) return Response.json({ error: "Report not found." }, { status: 404 });
    const name = parsed.data.assignedTo || null;
    const { error } = await admin.from("reports").update({ assigned_to_name: name }).eq("id", id);
    if (error) throw error;
    await appendEvent(admin, { reportId: id, actorId: user.id, actorName: profile.full_name, message: parsed.data.message || (name ? `Assigned to ${name}.` : "Assignment removed.") });
    return Response.json({ ok: true });
  } catch (error) { return authErrorResponse(error); }
}
