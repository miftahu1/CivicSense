import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

function fingerprintSecret() {
  const secret = process.env.ABUSE_IP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("ABUSE_HASH_SECRET_MISSING");
  return secret;
}

export function hmacFingerprint(value: string) {
  return createHmac("sha256", fingerprintSecret()).update(value).digest("hex");
}

export async function getRequestIpHash() {
  const requestHeaders = await headers();
  const configuredHeader = process.env.CIVICSENSE_CLIENT_IP_HEADER?.trim().toLowerCase();
  const candidates = configuredHeader
    ? [configuredHeader]
    : ["cf-connecting-ip", "x-vercel-forwarded-for", "x-nf-client-connection-ip"];
  for (const header of candidates) {
    const raw = requestHeaders.get(header);
    if (!raw) continue;
    const addresses = raw.split(",").map((value) => value.trim()).filter(Boolean);
    // Forwarded address chains append the connecting client to the right.
    const ip = (header === "x-forwarded-for" ? addresses.at(-1) : addresses[0]) || "";
    if (isIP(ip)) return hmacFingerprint(ip);
  }
  return null;
}

export async function consumeAbuseRateLimit(
  admin: SupabaseClient,
  key: string,
  windowSeconds: number,
  limit: number,
) {
  const { data, error } = await admin.rpc("consume_abuse_rate_limit", {
    p_bucket_key: key,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) throw new Error("ABUSE_RATE_LIMIT_RESULT_MISSING");
  return result as { allowed: boolean; request_count: number; retry_after_seconds: number };
}

export async function findActiveAbuseRestriction(admin: SupabaseClient, userId: string, ipHash: string | null) {
  const { data, error } = await admin.rpc("find_active_abuse_restriction", {
    p_user_id: userId,
    p_ip_hash: ipHash,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as { restriction_id: string; scope: string; reason: string; expires_at: string | null } | null;
}

export async function recordAbuseEvent(
  admin: SupabaseClient,
  input: {
    userId?: string | null;
    ipHash?: string | null;
    reportId?: string | null;
    eventType: string;
    riskScore: number;
    details?: Record<string, unknown>;
  },
) {
  const { error } = await admin.from("abuse_events").insert({
    user_id: input.userId || null,
    ip_hash: input.ipHash || null,
    report_id: input.reportId || null,
    event_type: input.eventType,
    risk_score: input.riskScore,
    details: input.details || {},
  });
  if (error) throw error;
}

export async function createAutomaticIpCooldown(admin: SupabaseClient, ipHash: string, reason: string, minutes: number) {
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  const { data, error } = await admin.from("abuse_restrictions").insert({
    scope: "ip",
    ip_hash: ipHash,
    reason,
    expires_at: expiresAt,
  }).select("id").single();
  if (error) throw error;
  return { id: data.id as string, expiresAt };
}
