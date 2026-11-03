import { z } from "zod";
import { authErrorResponse, requireAdmin } from "@/lib/supabase/server";
import { recordAbuseEvent } from "@/lib/abuse-protection";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("block-account"), userId: z.string().uuid(), reason: z.string().trim().min(3).max(1000), hours: z.union([z.literal(1), z.literal(24), z.literal(168), z.literal(876000)]) }),
  z.object({ action: z.literal("block-ip"), ipHash: z.string().regex(/^[a-f0-9]{64}$/i), reason: z.string().trim().min(3).max(1000), hours: z.union([z.literal(1), z.literal(24), z.literal(168), z.literal(876000)]) }),
  z.object({ action: z.literal("unblock"), restrictionId: z.string().uuid(), reason: z.string().trim().min(3).max(1000) }),
  z.object({ action: z.literal("review-event"), eventId: z.string().uuid(), note: z.string().trim().min(3).max(1000) }),
]);

export async function GET() {
  try {
    const { admin } = await requireAdmin();
    const [eventsResult, restrictionsResult] = await Promise.all([
      admin.from("abuse_events").select("id,user_id,ip_hash,report_id,event_type,risk_score,details,reviewed_at,review_note,created_at").order("created_at", { ascending: false }).limit(100),
      admin.from("abuse_restrictions").select("id,scope,user_id,ip_hash,reason,created_by,expires_at,lifted_at,lifted_by,lift_reason,created_at").order("created_at", { ascending: false }).limit(200),
    ]);
    if (eventsResult.error) throw eventsResult.error;
    if (restrictionsResult.error) throw restrictionsResult.error;
    const userIds = [...new Set([...(eventsResult.data || []).map((event) => event.user_id), ...(restrictionsResult.data || []).map((row) => row.user_id)].filter((id): id is string => Boolean(id)))];
    const profileResult = userIds.length ? await admin.from("profiles").select("id,full_name,role").in("id", userIds) : { data: [], error: null };
    if (profileResult.error) throw profileResult.error;
    const names = new Map((profileResult.data || []).map((profile) => [profile.id, { name: profile.full_name, role: profile.role }]));
    const now = Date.now();
    const restrictions = (restrictionsResult.data || []).map((row) => ({
      ...row,
      targetName: row.user_id ? names.get(row.user_id)?.name || "Unknown account" : null,
      active: !row.lifted_at && (!row.expires_at || new Date(row.expires_at).getTime() > now),
    }));
    const events = (eventsResult.data || []).map((event) => ({
      ...event,
      userName: event.user_id ? names.get(event.user_id)?.name || "Unknown account" : null,
      userRole: event.user_id ? names.get(event.user_id)?.role || null : null,
    }));
    return Response.json({ events, restrictions }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { admin, user: actor, profile } = await requireAdmin();
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Review the restriction details." }, { status: 400 });
    const input = parsed.data;

    if (input.action === "review-event") {
      const { error } = await admin.from("abuse_events").update({ reviewed_at: new Date().toISOString(), reviewed_by: actor.id, review_note: input.note }).eq("id", input.eventId);
      if (error) throw error;
      await recordAbuseEvent(admin, { userId: actor.id, eventType: "admin_abuse_event_reviewed", riskScore: 0, details: { sourceEventId: input.eventId, note: input.note, adminName: profile.full_name } });
      return Response.json({ ok: true });
    }

    if (input.action === "unblock") {
      const { data: restriction, error } = await admin.from("abuse_restrictions").select("id,scope,user_id,ip_hash,lifted_at").eq("id", input.restrictionId).maybeSingle();
      if (error) throw error;
      if (!restriction) return Response.json({ error: "Restriction not found." }, { status: 404 });
      if (restriction.lifted_at) return Response.json({ error: "This restriction has already been lifted." }, { status: 409 });
      const { error: liftError } = await admin.from("abuse_restrictions").update({ lifted_at: new Date().toISOString(), lifted_by: actor.id, lift_reason: input.reason }).eq("id", restriction.id).is("lifted_at", null);
      if (liftError) throw liftError;
      if (restriction.scope === "account" && restriction.user_id) {
        const { data: remaining, error: remainingError } = await admin.from("abuse_restrictions").select("id").eq("scope", "account").eq("user_id", restriction.user_id).is("lifted_at", null).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).limit(1);
        if (remainingError) {
          await admin.from("abuse_restrictions").update({ lifted_at: null, lifted_by: null, lift_reason: null }).eq("id", restriction.id);
          throw remainingError;
        }
        if (!remaining?.length) {
          const { error: unbanError } = await admin.auth.admin.updateUserById(restriction.user_id, { ban_duration: "none" });
          if (unbanError) {
            await admin.from("abuse_restrictions").update({ lifted_at: null, lifted_by: null, lift_reason: null }).eq("id", restriction.id);
            throw unbanError;
          }
        }
      }
      await recordAbuseEvent(admin, { userId: restriction.user_id, ipHash: restriction.ip_hash, eventType: "admin_restriction_lifted", riskScore: 0, details: { restrictionId: restriction.id, scope: restriction.scope, reason: input.reason, adminName: profile.full_name } });
      return Response.json({ ok: true });
    }

    const expiresAt = input.hours === 876000 ? null : new Date(Date.now() + input.hours * 60 * 60 * 1000).toISOString();
    let userId: string | null = null;
    let ipHash: string | null = null;
    let scope: "account" | "ip";
    if (input.action === "block-account") {
      const { data: target, error } = await admin.from("profiles").select("id,role").eq("id", input.userId).maybeSingle();
      if (error) throw error;
      if (!target) return Response.json({ error: "Account not found." }, { status: 404 });
      if (target.role === "admin") return Response.json({ error: "Administrator accounts cannot be blocked from this console." }, { status: 409 });
      const { data: existing, error: existingError } = await admin.from("abuse_restrictions").select("id,expires_at").eq("scope", "account").eq("user_id", target.id).is("lifted_at", null).limit(10);
      if (existingError) throw existingError;
      if ((existing || []).some((row) => !row.expires_at || new Date(row.expires_at).getTime() > Date.now())) return Response.json({ error: "This account already has an active restriction." }, { status: 409 });
      userId = target.id;
      scope = "account";
    } else {
      ipHash = input.ipHash.toLowerCase();
      const { data: existing, error: existingError } = await admin.from("abuse_restrictions").select("id,expires_at").eq("scope", "ip").eq("ip_hash", ipHash).is("lifted_at", null).limit(10);
      if (existingError) throw existingError;
      if ((existing || []).some((row) => !row.expires_at || new Date(row.expires_at).getTime() > Date.now())) return Response.json({ error: "This IP already has an active restriction." }, { status: 409 });
      scope = "ip";
    }
    const { data: restriction, error: insertError } = await admin.from("abuse_restrictions").insert({ scope, user_id: userId, ip_hash: ipHash, reason: input.reason, created_by: actor.id, expires_at: expiresAt }).select("id").single();
    if (insertError) throw insertError;
    if (userId) {
      const duration = expiresAt ? `${input.hours}h` : "876000h";
      const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: duration });
      if (banError) {
        await admin.from("abuse_restrictions").delete().eq("id", restriction.id);
        throw banError;
      }
    }
    await recordAbuseEvent(admin, { userId, ipHash, eventType: scope === "account" ? "admin_account_blocked" : "admin_ip_blocked", riskScore: 0, details: { restrictionId: restriction.id, scope, reason: input.reason, expiresAt, adminName: profile.full_name } });
    return Response.json({ ok: true, restrictionId: restriction.id });
  } catch (error) { return authErrorResponse(error); }
}
