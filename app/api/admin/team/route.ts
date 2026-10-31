import { z } from "zod";
import { authErrorResponse, requireAdmin } from "@/lib/supabase/server";

const teamUpdateSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["student", "staff"]),
  department: z.string().trim().max(120).optional().nullable(),
});

export async function GET() {
  try {
    const { admin } = await requireAdmin();
    const { data, error } = await admin.from("profiles").select("id,full_name,role,department,created_at").order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    return Response.json({ users: data || [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const { admin } = await requireAdmin();
    const parsed = teamUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Review the team member details." }, { status: 400 });
    const input = parsed.data;
    const department = input.role === "staff" ? input.department?.trim() : null;
    if (input.role === "staff" && (!department || department.length < 2)) {
      return Response.json({ error: "Assign a campus department before granting staff access." }, { status: 400 });
    }
    const { data: current, error: currentError } = await admin.from("profiles").select("id,role").eq("id", input.userId).maybeSingle();
    if (currentError) throw currentError;
    if (!current) return Response.json({ error: "Account not found." }, { status: 404 });
    if (current.role === "admin") return Response.json({ error: "Administrator access is managed separately." }, { status: 409 });
    const { data, error } = await admin.from("profiles").update({ role: input.role, department }).eq("id", input.userId)
      .select("id,full_name,role,department,created_at").single();
    if (error) throw error;
    return Response.json({ user: data });
  } catch (error) { return authErrorResponse(error); }
}
