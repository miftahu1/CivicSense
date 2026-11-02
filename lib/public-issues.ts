import type { SupabaseClient } from "@supabase/supabase-js";

export const PUBLIC_ISSUE_BOARD_KEY = "public_issue_board";

export async function isPublicIssueBoardEnabled(admin: SupabaseClient) {
  const { data, error } = await admin.from("app_settings").select("setting_value").eq("setting_key", PUBLIC_ISSUE_BOARD_KEY).maybeSingle();
  if (error) throw error;
  return data?.setting_value?.enabled === true;
}
