"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowUpRight, BarChart3, Building2, Clock3, FileCheck2, Search, ShieldAlert, UsersRound } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PriorityPill, StatusPill } from "@/components/report-ui";
import { categoryLabel, reportTitle, tr } from "@/lib/i18n";
import { timeAgo } from "@/lib/format";
import type { Report } from "@/lib/types";

export function AdminActivityLog() {
  const { user, reports, locale, openReport } = useWorkspace();
  const [search, setSearch] = useState("");
  const entries = useMemo(() => reports.flatMap((report) => report.events.map((event) => ({ report, event })))
    .sort((a, b) => b.event.createdAt.localeCompare(a.event.createdAt))
    .filter(({ report, event }) => !search || `${report.ticketNumber} ${report.titleEn} ${report.titleAs} ${event.actor} ${event.message}`.toLowerCase().includes(search.toLowerCase())), [reports, search]);
  if (user.role !== "admin") return <div className="panel empty-state"><ShieldAlert size={22}/><h2>{tr(locale,"Administrator access required","প্ৰশাসকৰ অনুমতি প্ৰয়োজন")}</h2></div>;
  return <>
    <div className="page-heading"><div><div className="section-kicker">{tr(locale,"Administrator workspace · Audit trail","প্ৰশাসকৰ ৱৰ্কস্পেচ · কাৰ্যকলাপৰ ৰেকৰ্ড")}</div><h1>{tr(locale,"Activity log","কাৰ্যকলাপৰ লগ")}</h1><p>{tr(locale,"A searchable timeline of report submissions, staff updates, and status decisions.","প্ৰতিবেদন দাখিল, কৰ্মচাৰীৰ আপডেট আৰু স্থিতিৰ সিদ্ধান্তৰ সন্ধানযোগ্য সময়ৰেখা।")}</p></div><div className="heading-actions"><span className="status-pill status-review"><Activity size={13}/>{entries.length} {tr(locale,"events","টা ঘটনা")}</span></div></div>
    <section className="panel admin-activity-panel"><div className="admin-activity-toolbar"><div className="admin-activity-search"><Search size={15}/><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder={tr(locale,"Search ticket, report, staff or update…","টিকিট, প্ৰতিবেদন, কৰ্মচাৰী বা আপডেট বিচাৰক…")}/></div><span>{tr(locale,"Newest first","নতুন ঘটনা প্ৰথমে")}</span></div>
      {entries.length ? <ol className="admin-audit-list">{entries.map(({report,event},index)=><li key={`${event.id}-${index}`}><span className="admin-audit-marker"><Activity size={13}/></span><div className="admin-audit-main"><div className="admin-audit-top"><span>{report.ticketNumber} · {timeAgo(event.createdAt,locale)}</span>{event.newStatus && <StatusPill status={event.newStatus} language={locale}/>}</div><h2>{reportTitle(report,locale)}</h2><p>{event.message}</p><div className="admin-audit-meta"><span><UsersRound size={12}/>{event.actor}</span><span><Building2 size={12}/>{report.building}{report.area ? ` · ${report.area}` : ""}</span><span>{categoryLabel(report.category,locale)}</span><PriorityPill priority={report.confirmedPriority||report.suggestedPriority} language={locale}/></div></div><button className="button button-outline button-small" onClick={()=>openReport(report.id)}>{tr(locale,"Open","খোলক")} <ArrowUpRight size={13}/></button></li>)}</ol>
        : <div className="empty-state admin-audit-empty"><Activity size={23}/><h2>{tr(locale,"No matching activity","মিল থকা কাৰ্যকলাপ নাই")}</h2><p>{tr(locale,"Report submissions and team updates will appear here.","প্ৰতিবেদন দাখিল আৰু দলৰ আপডেট ইয়াত দেখা যাব।")}</p></div>}
    </section>
  </>;
}

type Insights = {
  active: number; pendingReview: number; awaitingAdminReview: number; investigating: number; inProgress: number; resolved: number;
  categories: { category: Report["category"]; total: number }[];
  priorities: { priority: string; total: number }[];
  languages: { language: string; total: number }[];
  backlog: { underOneDay: number; oneToThreeDays: number; threeToSevenDays: number; overSevenDays: number; unassigned: number; urgentOlderThanThreeDays: number; averageOpenAgeDays: number };
};

export function AdminResponseInsights() {
  const { user, locale } = useWorkspace();
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/metrics", { cache: "no-store", signal: controller.signal }).then(async(response)=>{
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load response insights.");
      setData(body as Insights);
    }).catch((reason:unknown)=>{if(reason instanceof DOMException&&reason.name==="AbortError")return;setError(reason instanceof Error?reason.message:"Could not load response insights.");}).finally(()=>setLoading(false));
    return ()=>controller.abort();
  },[]);
  if (user.role !== "admin") return <div className="panel empty-state"><ShieldAlert size={22}/><h2>{tr(locale,"Administrator access required","প্ৰশাসকৰ অনুমতি প্ৰয়োজন")}</h2></div>;
  if (loading) return <div className="panel empty-state"><Clock3 size={20}/><p>{tr(locale,"Preparing campus response insights…","কেম্পাছৰ সঁহাৰিৰ অন্তৰ্দৃষ্টি প্ৰস্তুত হৈছে…")}</p></div>;
  if (error || !data) return <div className="panel empty-state"><AlertTriangle size={20}/><h2>{tr(locale,"Insights are unavailable","অন্তৰ্দৃষ্টি উপলব্ধ নহয়")}</h2><p>{error}</p></div>;
  const maxCategory = Math.max(1,...data.categories.map((item)=>item.total));
  const backlogRows = [
    { label: tr(locale,"Under 24 hours","২৪ ঘণ্টাৰ ভিতৰত"), count:data.backlog.underOneDay, tone:"green" },
    { label: tr(locale,"1–3 days","১–৩ দিন"), count:data.backlog.oneToThreeDays, tone:"gold" },
    { label: tr(locale,"3–7 days","৩–৭ দিন"), count:data.backlog.threeToSevenDays, tone:"amber" },
    { label: tr(locale,"Over 7 days","৭ দিনতকৈ অধিক"), count:data.backlog.overSevenDays, tone:"red" },
  ];
  return <>
    <div className="page-heading"><div><div className="section-kicker">{tr(locale,"Administrator workspace · Operational health","প্ৰশাসকৰ ৱৰ্কস্পেচ · কামৰ অৱস্থা")}</div><h1>{tr(locale,"Response insights","সঁহাৰিৰ অন্তৰ্দৃষ্টি")}</h1><p>{tr(locale,"See where the queue is aging, what needs assignment, and which issues need attention first.","শাৰীত থকা প্ৰতিবেদন কিমান পুৰণি হৈছে, ক’ত দায়িত্ব দিয়া হোৱা নাই আৰু কোনটো আগতে চাব লাগে ইয়াত চাওক।")}</p></div></div>
    <section className="admin-insight-kpis"><InsightKpi icon={<FileCheck2/>} label={tr(locale,"Active reports","সক্ৰিয় প্ৰতিবেদন")} value={data.active} note={tr(locale,"Currently unresolved","এতিয়াও সমাধান হোৱা নাই")}/><InsightKpi icon={<Clock3/>} label={tr(locale,"Awaiting admin review","প্ৰশাসকৰ পৰ্যালোচনাৰ অপেক্ষাত")} value={data.awaitingAdminReview} note={tr(locale,"Staff submitted for decision","কৰ্মচাৰীয়ে সিদ্ধান্তৰ বাবে পঠিয়াইছে")}/><InsightKpi icon={<Building2/>} label={tr(locale,"Unassigned","দায়িত্ব দিয়া হোৱা নাই")} value={data.backlog.unassigned} note={tr(locale,"Open reports without a department","বিভাগ নথকা মুকলি প্ৰতিবেদন")}/><InsightKpi icon={<AlertTriangle/>} label={tr(locale,"Urgent · older than 3 days","জৰুৰী · ৩ দিনতকৈ পুৰণি")} value={data.backlog.urgentOlderThanThreeDays} note={tr(locale,"Needs a prompt check","সোনকালে পৰীক্ষা কৰিব লাগে")}/></section>
    <div className="admin-insights-grid"><section className="panel admin-insight-card"><div className="section-kicker">{tr(locale,"Open report age","মুকলি প্ৰতিবেদনৰ বয়স")}</div><h2>{tr(locale,"Backlog by age","বয়স অনুসৰি বাকী থকা কাম")}</h2><p className="admin-insight-lead">{tr(locale,"Average open report age","মুকলি প্ৰতিবেদনৰ গড় বয়স")} <strong>{data.backlog.averageOpenAgeDays} {tr(locale,"days","দিন")}</strong></p><div className="admin-age-bars">{backlogRows.map((row)=><div className="admin-age-row" key={row.label}><div><span>{row.label}</span><strong>{row.count}</strong></div><div className="admin-age-track"><i className={`tone-${row.tone}`} style={{width:`${data.active?Math.max(3,row.count/data.active*100):0}%`}}/></div></div>)}</div></section>
      <section className="panel admin-insight-card"><div className="section-kicker">{tr(locale,"Work distribution","কামৰ বিতৰণ")}</div><h2>{tr(locale,"Categories in the queue","শাৰীত থকা শ্ৰেণীসমূহ")}</h2>{data.categories.length ? <div className="admin-bars">{data.categories.slice(0,7).map((item)=><div className="admin-bar-row" key={item.category}><span>{categoryLabel(item.category,locale)}</span><div><i style={{width:`${Math.max(4,item.total/maxCategory*100)}%`}}/></div><strong>{item.total}</strong></div>)}</div> : <p className="field-hint">{tr(locale,"No reports have been submitted yet.","এতিয়াও কোনো প্ৰতিবেদন দাখিল হোৱা নাই।")}</p>}</section>
      <section className="panel admin-insight-card"><div className="section-kicker">{tr(locale,"Priority attention","অগ্ৰাধিকাৰৰ মনোযোগ")}</div><h2>{tr(locale,"Unresolved by priority","অগ্ৰাধিকাৰ অনুসৰি অসমাধিত")}</h2><div className="admin-priority-grid">{data.priorities.map((item)=><div key={item.priority} className={`admin-priority-card p-${item.priority.toLowerCase()}`}><span>{item.priority}</span><strong>{item.total}</strong></div>)}</div></section>
      <section className="panel admin-insight-card"><div className="section-kicker">{tr(locale,"Workflow health","কামৰ প্ৰবাহৰ অৱস্থা")}</div><h2>{tr(locale,"Where reports are now","প্ৰতিবেদনসমূহৰ বৰ্তমান অৱস্থা")}</h2><div className="admin-workflow-list"><WorkflowRow label={tr(locale,"Under review","পৰ্যালোচনাধীন")} value={data.pendingReview}/><WorkflowRow label={tr(locale,"Investigating","অনুসন্ধান চলি আছে")} value={data.investigating}/><WorkflowRow label={tr(locale,"In progress","কাম চলি আছে")} value={Math.max(0,data.inProgress-data.investigating)}/><WorkflowRow label={tr(locale,"Awaiting admin review","প্ৰশাসকৰ পৰ্যালোচনাৰ অপেক্ষাত")} value={data.awaitingAdminReview}/><WorkflowRow label={tr(locale,"Resolved","সমাধান হৈছে")} value={data.resolved}/></div></section>
    </div><p className="admin-insight-footnote"><BarChart3 size={13}/>{tr(locale,"Counts exclude synthetic demonstration reports and reflect current database records.","এই গণনাত কল্পিত ডেম’ প্ৰতিবেদন নাই; ডেটাবেছৰ বৰ্তমান তথ্যৰ ওপৰত ভিত্তি কৰি কৰা হৈছে।")}</p>
  </>;
}

function InsightKpi({ icon, label, value, note }: { icon: React.ReactNode; label:string; value:number; note:string }) { return <article className="admin-insight-kpi"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>; }
function WorkflowRow({ label, value }: { label:string; value:number }) { return <div className="admin-workflow-row"><span>{label}</span><strong>{value}</strong></div>; }
