import { z } from "zod";
import { PUBLIC_ISSUE_BOARD_KEY, isPublicIssueBoardEnabled } from "@/lib/public-issues";
import { authErrorResponse, requireAdmin } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { admin } = await requireAdmin();
    return Response.json({ enabled: await isPublicIssueBoardEnabled(admin) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const { admin, user } = await requireAdmin();
    const parsed = z.object({ enabled: z.boolean() }).safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Choose whether the public issues page should be enabled." }, { status: 400 });
    const { error } = await admin.from("app_settings").upsert({
      setting_key: PUBLIC_ISSUE_BOARD_KEY,
      setting_value: { enabled: parsed.data.enabled },
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "setting_key" });
    if (error) throw error;
    return Response.json({ enabled: parsed.data.enabled }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}
