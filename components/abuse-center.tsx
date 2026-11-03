"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, Ban, Check, Clock3, ExternalLink, Fingerprint, RefreshCw, Shield, ShieldAlert, ShieldCheck, UnlockKeyhole, UserRound, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace-provider";
import { tr } from "@/lib/i18n";
import { formatDate } from "@/lib/format";

type AbuseEvent = {
  id: string; user_id: string | null; userName: string | null; userRole: string | null; ip_hash: string | null;
  report_id: string | null; event_type: string; risk_score: number; details: Record<string, unknown>;
  reviewed_at: string | null; review_note: string | null; created_at: string;
};
type Restriction = {
  id: string; scope: "account" | "ip"; user_id: string | null; ip_hash: string | null;
  reason: string; targetName: string | null; expires_at: string | null; lifted_at: string | null; active: boolean; created_at: string;
};
type AbuseData = { events: AbuseEvent[]; restrictions: Restriction[] };

const eventTitle: Record<string, [string, string]> = {
  report_burst_limited: ["Rapid report submissions", "দ্ৰুত প্ৰতিবেদন দাখিল"],
  network_burst_limited: ["Network report burst", "নেটৱৰ্কৰ পৰা দ্ৰুত প্ৰতিবেদন"],
  network_auto_blocked: ["Automatic 15-minute IP cooldown", "স্বয়ংক্ৰিয় ১৫ মিনিটৰ IP কুলডাউন"],
  image_analysis_burst_limited: ["Repeated image analysis requests", "বাৰে বাৰে ছবি বিশ্লেষণৰ অনুৰোধ"],
  network_image_analysis_burst_limited: ["Network image analysis burst", "নেটৱৰ্কৰ পৰা ছবি বিশ্লেষণৰ দ্ৰুত অনুৰোধ"],
  repeated_report_content: ["Repeated report content", "একেধৰণৰ প্ৰতিবেদন বাৰে বাৰে দাখিল"],
  suspicious_link_or_solicitation: ["Link with a payment or credential request", "পেমেণ্ট বা প্ৰৱেশ তথ্য বিচৰা লিংক"],
};

export function AbuseCenter() {
  const { user, locale } = useWorkspace();
  const [data, setData] = useState<AbuseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<AbuseEvent | null>(null);
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState(24);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/abuse", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Abuse review could not be loaded.");
      setData(body as AbuseData);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Abuse review could not be loaded.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function act(payload: Record<string, unknown>, key: string) {
    setBusy(key);
    try {
      const response = await fetch("/api/admin/abuse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The security action could not be completed.");
      toast.success(tr(locale, "Security record updated.", "সুৰক্ষা ৰেকৰ্ড আপডেট কৰা হ’ল।"));
      setReason("");
      setSelectedEvent(null);
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : tr(locale, "The security action failed.", "সুৰক্ষা পদক্ষেপ বিফল হ’ল।"));
    } finally { setBusy(""); }
  }

  if (user.role !== "admin") return <div className="panel empty-state"><ShieldAlert size={22}/><h2>{tr(locale, "Administrator access required", "প্ৰশাসকৰ অনুমতি প্ৰয়োজন")}</h2></div>;
  const detections = (data?.events || []).filter((event) => !event.event_type.startsWith("admin_"));
  const activeRestrictions = (data?.restrictions || []).filter((restriction) => restriction.active);

  return <>
    <div className="page-heading"><div><div className="section-kicker">{tr(locale, "Administrator workspace · Trust and safety", "প্ৰশাসকৰ ৱৰ্কস্পেচ · সুৰক্ষা আৰু বিশ্বাস")}</div><h1>{tr(locale, "Abuse review", "অপব্যৱহাৰৰ পৰ্যালোচনা")}</h1><p>{tr(locale, "Review automated signals, restrict accounts or networks when evidence supports it, and record the decision.", "স্বয়ংক্ৰিয় সংকেত পৰ্যালোচনা কৰক, প্ৰমাণ থাকিলে একাউণ্ট বা নেটৱৰ্ক সীমিত কৰক আৰু সিদ্ধান্তৰ ৰেকৰ্ড ৰাখক।")}</p></div><button className="button button-outline" onClick={() => void load()} disabled={loading}><RefreshCw size={14}/>{tr(locale, "Refresh", "পুনৰ লোড")}</button></div>
    <section className="abuse-summary-grid">
      <article className="abuse-summary-card"><span><Activity size={17}/></span><div><small>{tr(locale, "Signals to review", "পৰ্যালোচনাৰ সংকেত")}</small><strong>{detections.filter((event) => !event.reviewed_at).length}</strong></div></article>
      <article className="abuse-summary-card"><span><Ban size={17}/></span><div><small>{tr(locale, "Active restrictions", "সক্ৰিয় নিষেধাজ্ঞা")}</small><strong>{activeRestrictions.length}</strong></div></article>
      <article className="abuse-summary-card"><span><ShieldCheck size={17}/></span><div><small>{tr(locale, "Account protections", "একাউণ্ট সুৰক্ষা")}</small><strong>{tr(locale, "On", "সক্ৰিয়")}</strong></div></article>
    </section>
    <div className="abuse-policy-note"><Shield size={16}/><p>{tr(locale, "Signals are review aids, not proof of fraud. Rate limits apply automatically; account and IP blocks require an administrator. IP fingerprints are stored as one-way hashes, and administrators are exempt from IP blocks so they can investigate and reverse them.", "সংকেতসমূহ পৰ্যালোচনাৰ সহায়, জালিয়াতিৰ প্ৰমাণ নহয়। গতি সীমা স্বয়ংক্ৰিয়ভাৱে প্ৰয়োগ হয়; একাউণ্ট আৰু IP ব্লক কৰিবলৈ প্ৰশাসকৰ পদক্ষেপ লাগে। IP ঠিকনা একমুখী হেশ্ব হিচাপে ৰখা হয়, আৰু অনুসন্ধান/বাতিল কৰিব পৰাকৈ প্ৰশাসক IP ব্লকৰ পৰা মুক্ত থাকে।")}</p></div>

    <section className="panel abuse-panel"><div className="abuse-panel-head"><div><div className="section-kicker">{tr(locale, "Detection queue", "পৰ্যালোচনাৰ শাৰী")}</div><h2>{tr(locale, "Recent abuse signals", "শেহতীয়া অপব্যৱহাৰৰ সংকেত")}</h2></div><span>{detections.length} {tr(locale, "signals", "টা সংকেত")}</span></div>
      {loading ? <div className="empty-state"><Clock3 size={19}/><p>{tr(locale, "Loading abuse signals…", "অপব্যৱহাৰৰ সংকেত লোড হৈছে…")}</p></div> : error ? <div className="empty-state"><AlertTriangle size={20}/><h3>{tr(locale, "Security data unavailable", "সুৰক্ষা তথ্য উপলব্ধ নহয়")}</h3><p>{error}</p></div> : detections.length ? <div className="abuse-event-list">{detections.map((event) => {
        const title = eventTitle[event.event_type] || [event.event_type.replaceAll("_", " "), event.event_type.replaceAll("_", " ")];
        const elevated = event.risk_score >= 4;
        return <article className={`abuse-event ${event.reviewed_at ? "is-reviewed" : ""}`} key={event.id}>
          <div className={`abuse-event-icon ${elevated ? "risk-high" : "risk-low"}`}>{elevated ? <AlertTriangle size={16}/> : <Activity size={16}/>}</div>
          <div className="abuse-event-body"><div className="abuse-event-heading"><div><strong>{tr(locale, title[0], title[1])}</strong><span className={`abuse-risk-tag ${elevated ? "" : "risk-soft"}`}>{tr(locale, elevated ? "Review suggested" : "Rate limit", elevated ? "পৰ্যালোচনা কৰক" : "গতি সীমা")}</span></div><time>{formatDate(event.created_at, true, locale)}</time></div>
            <p>{event.userName ? <><UserRound size={13}/>{event.userName}{event.userRole ? ` · ${event.userRole}` : ""}</> : tr(locale, "Account unavailable", "একাউণ্ট উপলব্ধ নহয়")}{event.report_id && <> · {tr(locale, "Report", "প্ৰতিবেদন")} {event.report_id.slice(0, 8)}</>}{event.ip_hash && <span className="abuse-fingerprint"><Fingerprint size={12}/> {event.ip_hash.slice(0, 12)}…</span>}</p>
            {typeof event.details.reason === "string" && <small>{event.details.reason}</small>}
            {event.reviewed_at && <div className="abuse-review-note"><Check size={13}/>{tr(locale, "Reviewed", "পৰ্যালোচনা কৰা হৈছে")}{event.review_note ? ` · ${event.review_note}` : ""}</div>}
            <div className="abuse-event-actions">{!event.reviewed_at && <button className="button button-outline button-small" disabled={busy === event.id} onClick={() => { setSelectedEvent(event); setReason(""); }}>{tr(locale, "Investigate / restrict", "অনুসন্ধান / সীমিত কৰক")}</button>}{event.report_id && <a className="button button-outline button-small" href={`/app/reports/${event.report_id}`} target="_blank" rel="noreferrer">{tr(locale, "Open report", "প্ৰতিবেদন খোলক")}<ExternalLink size={12}/></a>}</div>
          </div>
        </article>;
      })}</div> : <div className="empty-state"><ShieldCheck size={22}/><h3>{tr(locale, "No abuse signals recorded", "অপব্যৱহাৰৰ সংকেত নাই")}</h3><p>{tr(locale, "Rate-limit and suspicious-pattern signals will appear here when detected.", "গতি সীমা আৰু সন্দেহজনক আচৰণৰ সংকেত পালে ইয়াত দেখা যাব।")}</p></div>}
    </section>

    {selectedEvent && <section className="panel abuse-action-panel"><div className="abuse-panel-head"><div><div className="section-kicker">{tr(locale, "Admin decision", "প্ৰশাসকৰ সিদ্ধান্ত")}</div><h2>{tr(locale, "Investigate this signal", "এই সংকেত অনুসন্ধান কৰক")}</h2></div><button className="button button-outline button-small" onClick={() => setSelectedEvent(null)}>{tr(locale, "Cancel", "বাতিল")}</button></div><p className="muted-copy">{tr(locale, "A restriction affects real users. Record why you are applying it; choose the shortest duration that addresses the evidence.", "নিষেধাজ্ঞাই প্ৰকৃত ব্যৱহাৰকাৰীক প্ৰভাৱিত কৰে। কিয় প্ৰয়োগ কৰিছে লিখক আৰু প্ৰমাণৰ সৈতে খাপ খোৱা আটাইতকৈ কম সময় বাছক।")}</p><label className="abuse-reason-field">{tr(locale, "Investigation note / reason", "অনুসন্ধানৰ টোকা / কাৰণ")}<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={1000} placeholder={tr(locale, "Describe the evidence and decision…", "প্ৰমাণ আৰু সিদ্ধান্তৰ বিৱৰণ দিয়ক…")}/></label><label className="abuse-duration-field">{tr(locale, "Restriction duration", "নিষেধাজ্ঞাৰ সময়")}<select value={hours} onChange={(event) => setHours(Number(event.target.value))}><option value={1}>{tr(locale, "1 hour", "১ ঘণ্টা")}</option><option value={24}>{tr(locale, "24 hours", "২৪ ঘণ্টা")}</option><option value={168}>{tr(locale, "7 days", "৭ দিন")}</option><option value={876000}>{tr(locale, "Permanent · 100 years", "স্থায়ী · ১০০ বছৰ")}</option></select></label><div className="abuse-action-buttons">{selectedEvent.user_id && <button className="button button-danger button-small" disabled={busy === "block-account" || reason.trim().length < 3} onClick={() => void act({ action: "block-account", userId: selectedEvent.user_id, reason: reason.trim(), hours }, "block-account")}><UserRound size={14}/>{tr(locale, "Block account", "একাউণ্ট ব্লক")}</button>}{selectedEvent.ip_hash && <button className="button button-danger button-small" disabled={busy === "block-ip" || reason.trim().length < 3} onClick={() => void act({ action: "block-ip", ipHash: selectedEvent.ip_hash, reason: reason.trim(), hours }, "block-ip")}><Fingerprint size={14}/>{tr(locale, "Block this IP", "এই IP ব্লক")}</button>}<button className="button button-outline button-small" disabled={busy === selectedEvent.id || reason.trim().length < 3} onClick={() => void act({ action: "review-event", eventId: selectedEvent.id, note: reason.trim() }, selectedEvent.id)}><Check size={14}/>{tr(locale, "Record review, no block", "পৰ্যালোচনা সংৰক্ষণ কৰক, ব্লক নকৰিব")}</button></div></section>}

    <section className="panel abuse-panel"><div className="abuse-panel-head"><div><div className="section-kicker">{tr(locale, "Enforcement", "নিষেধাজ্ঞা")}</div><h2>{tr(locale, "Active blocks and review history", "সক্ৰিয় ব্লক আৰু পৰ্যালোচনাৰ ইতিহাস")}</h2></div><span>{activeRestrictions.length} {tr(locale, "active", "সক্ৰিয়")}</span></div>
      {activeRestrictions.length ? <div className="abuse-restriction-list">{activeRestrictions.map((restriction) => <article className="abuse-restriction" key={restriction.id}><div className="abuse-event-icon risk-high">{restriction.scope === "account" ? <UserRound size={16}/> : <Fingerprint size={16}/>}</div><div className="abuse-event-body"><div className="abuse-event-heading"><strong>{restriction.scope === "account" ? restriction.targetName : `${tr(locale, "IP fingerprint", "IP হেশ্ব")} ${restriction.ip_hash?.slice(0, 12)}…`}</strong><span className="abuse-risk-tag">{restriction.scope === "account" ? tr(locale, "Account blocked", "একাউণ্ট ব্লক") : tr(locale, "IP blocked", "IP ব্লক")}</span></div><p>{restriction.reason}</p><small>{restriction.expires_at ? `${tr(locale, "Expires", "সময় শেষ")}: ${formatDate(restriction.expires_at, true, locale)}` : tr(locale, "Permanent until lifted by an administrator", "প্ৰশাসকে উঠাই নিদিয়ালৈকে স্থায়ী")}</small><div className="abuse-unblock-row"><input aria-label={tr(locale, "Reason for lifting restriction", "নিষেধাজ্ঞা উঠোৱাৰ কাৰণ")} placeholder={tr(locale, "Investigation outcome / unblock reason", "অনুসন্ধানৰ ফল / আনব্লকৰ কাৰণ")} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000}/><button className="button button-outline button-small" disabled={busy === restriction.id || reason.trim().length < 3} onClick={() => void act({ action: "unblock", restrictionId: restriction.id, reason: reason.trim() }, restriction.id)}><UnlockKeyhole size={13}/>{tr(locale, "Unblock", "আনব্লক")}</button></div></div></article>)}</div> : <div className="empty-state abuse-no-blocks"><ShieldCheck size={20}/><p>{tr(locale, "No accounts or IPs are currently blocked.", "বৰ্তমান কোনো একাউণ্ট বা IP ব্লক কৰা হোৱা নাই।")}</p></div>}
      {(data?.restrictions || []).some((restriction) => !restriction.active) && <details className="abuse-history"><summary><UsersRound size={14}/>{tr(locale, "Past restrictions", "পূৰ্বৰ নিষেধাজ্ঞা")} · {(data?.restrictions || []).filter((restriction) => !restriction.active).length}</summary><div>{(data?.restrictions || []).filter((restriction) => !restriction.active).map((restriction) => <p key={restriction.id}><Check size={12}/>{restriction.scope === "account" ? restriction.targetName : `${tr(locale, "IP", "IP")} ${restriction.ip_hash?.slice(0, 12)}…`} · {restriction.reason}</p>)}</div></details>}
    </section>
  </>;
}
