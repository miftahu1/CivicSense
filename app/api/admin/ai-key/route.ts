import { z } from "zod";
import { authErrorResponse, requireAdmin } from "@/lib/supabase/server";

const selectionSchema = z.object({ slot: z.enum(["primary", "backup"]) });
const settingKey = "gemini_key_slot";

export async function GET() {
  try {
    const { admin } = await requireAdmin();
    const { data, error } = await admin.from("app_settings").select("setting_value").eq("setting_key", settingKey).maybeSingle();
    if (error) throw error;
    return Response.json({ slot: data?.setting_value === "backup" && process.env.BACKUP_GEMINI_API_KEY ? "backup" : "primary", primaryConfigured: Boolean(process.env.GEMINI_API_KEY), backupConfigured: Boolean(process.env.BACKUP_GEMINI_API_KEY) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { admin, user } = await requireAdmin();
    const parsed = selectionSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Choose a valid Gemini key." }, { status: 400 });
    if (parsed.data.slot === "backup" && !process.env.BACKUP_GEMINI_API_KEY) return Response.json({ error: "BACKUP_GEMINI_API_KEY is not configured on the server." }, { status: 409 });
    const { error } = await admin.from("app_settings").upsert({ setting_key: settingKey, setting_value: parsed.data.slot, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "setting_key" });
    if (error) throw error;
    return Response.json({ ok: true, slot: parsed.data.slot });
  } catch (error) { return authErrorResponse(error); }
}
