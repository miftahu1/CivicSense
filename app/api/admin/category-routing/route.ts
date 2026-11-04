import { z } from "zod";
import { categories } from "@/lib/types";
import { campusDepartments, normalizeDepartment } from "@/lib/departments";
import { authErrorResponse, requireAdmin } from "@/lib/supabase/server";

const routeSchema = z.object({ category: z.enum(categories), department: z.string().nullable() });

export async function GET() {
  try {
    const { admin } = await requireAdmin();
    const [{ data: routes, error }, { data: staff, error: staffError }] = await Promise.all([
      admin.from("category_department_routes").select("category,department,updated_at").order("category"),
      admin.from("profiles").select("department").eq("role", "staff"),
    ]);
    if (error) throw error;
    if (staffError) throw staffError;
    return Response.json({ routes: routes || [], staffedDepartments: [...new Set((staff || []).map((row) => normalizeDepartment(row.department)).filter(Boolean))] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const { admin, profile } = await requireAdmin();
    const parsed = routeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Choose a valid category and department." }, { status: 400 });
    const department = parsed.data.department ? normalizeDepartment(parsed.data.department) : null;
    if (parsed.data.department && (!department || !campusDepartments.includes(department))) return Response.json({ error: "Choose a configured campus department." }, { status: 400 });
    const { data, error } = await admin.from("category_department_routes").upsert({ category: parsed.data.category, department, updated_by: profile.id, updated_at: new Date().toISOString() }, { onConflict: "category" }).select("category,department,updated_at").single();
    if (error) throw error;
    console.info("Category department route updated", { category: data.category, department: data.department, actorId: profile.id });
    return Response.json({ route: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authErrorResponse(error); }
}
