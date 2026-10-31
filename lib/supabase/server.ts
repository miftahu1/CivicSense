import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase is not configured. Copy .env.example to .env.local and add your project keys.");
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Server Components cannot write cookies. */ }
      },
    },
  });
}

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service configuration is missing.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function requireUser() {
  const auth = await createSupabaseServerClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) throw new Error("UNAUTHORIZED");
  const admin = createServiceClient();
  const { data: profile, error: profileError } = await admin.from("profiles").select("id, full_name, role, preferred_language").eq("id", user.id).single();
  if (profileError || !profile) throw new Error("PROFILE_MISSING");
  return { auth, admin, user, profile };
}

export async function requireAdmin() {
  const context = await requireUser();
  if (context.profile.role !== "admin") throw new Error("FORBIDDEN");
  return context;
}

export function authErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : message === "PROFILE_MISSING" ? 403 : 500;
  return Response.json({ error: message === "UNAUTHORIZED" ? "Please sign in to continue." : message === "FORBIDDEN" ? "Administrator access is required." : message }, { status });
}
