import { authErrorResponse, createServiceClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeDepartment } from "@/lib/departments";
import { findActiveAbuseRestriction, getRequestIpHash } from "@/lib/abuse-protection";

export async function POST() {
  try {
    const auth = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user) return Response.json({ error: "Please sign in to continue." }, { status: 401 });

    const admin = createServiceClient();
    const { data: existing, error: lookupError } = await admin
      .from("profiles")
      .select("id, full_name, role, preferred_language, department")
      .eq("id", user.id)
      .maybeSingle();
    if (lookupError) {
      console.error("Signed-in profile lookup failed", lookupError);
      return Response.json({ error: "Campus profile storage is unavailable. Apply the Supabase migrations and try again." }, { status: 503 });
    }
    if (existing) {
      if (existing.role !== "admin" && await findActiveAbuseRestriction(admin, user.id, await getRequestIpHash())) {
        return Response.json({ error: "This account or network is temporarily restricted. Contact a campus administrator if you believe this is a mistake.", code: "ACCOUNT_RESTRICTED" }, { status: 403 });
      }
      return Response.json({ profile: { ...existing, department: existing.role === "staff" ? normalizeDepartment(existing.department) || existing.department : null } }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const metadataName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
    const emailName = user.email?.split("@")[0]?.trim() || "";
    const preferredLanguage = user.user_metadata?.preferred_language === "as" ? "as" : "en";
    const { error: insertError } = await admin.from("profiles").upsert({
      id: user.id,
      full_name: metadataName || emailName || "Campus member",
      role: "student",
      preferred_language: preferredLanguage,
    }, { onConflict: "id", ignoreDuplicates: true });
    if (insertError) {
      console.error("Signed-in profile recovery failed", insertError);
      return Response.json({ error: "Your account profile could not be prepared. Check the Supabase server configuration and try again." }, { status: 503 });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, full_name, role, preferred_language, department")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) throw profileError || new Error("PROFILE_MISSING");
    if (profile.role !== "admin" && await findActiveAbuseRestriction(admin, user.id, await getRequestIpHash())) {
      return Response.json({ error: "This account or network is temporarily restricted. Contact a campus administrator if you believe this is a mistake.", code: "ACCOUNT_RESTRICTED" }, { status: 403 });
    }
    return Response.json({ profile: { ...profile, department: profile.role === "staff" ? normalizeDepartment(profile.department) || profile.department : null } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return authErrorResponse(error);
  }
}
