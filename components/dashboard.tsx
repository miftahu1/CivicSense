"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity as ActivityIcon, ArrowRight, ArrowUpRight, CircleCheck, CircleDot, Clock3, FilePlus2, FileText, Languages, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useWorkspace } from "@/components/workspace-provider";
import { PriorityPill, StatusPill } from "@/components/report-ui";
import { categoryLabel, languageLabel, reportSummary, reportTitle, tr } from "@/lib/i18n";
import { formatDate, timeAgo } from "@/lib/format";
import type { Language, Priority, Report } from "@/lib/types";
import { PublicIssueBoardToggle } from "@/components/public-issue-board-toggle";
import { CampusIssueMap } from "@/components/campus-issue-map";

function PanelTitle({ title, href, action }: { title: string; href?: string; action?: string }) {
  const { locale } = useWorkspace();
  return <div className="panel-head"><h2>{title}</h2>{href && <Link href={href} className="panel-link">{action || tr(locale, "View all", "সকলো চাওক")}<ArrowRight size={12}/></Link>}</div>;
}

export function Dashboard({ admin = false }: { admin?: boolean }) {
  const { user, reports, clusters, isDemo, locale } = useWorkspace();
  const [localHour, setLocalHour] = useState<number | null>(null);
  useEffect(() => {
    const updateLocalHour = () => setLocalHour(new Date().getHours());
    updateLocalHour();
    const timer = window.setInterval(updateLocalHour, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const rows = admin ? reports : reports.filter((report) => report.reporterId === user.id);
  const sorted = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const open = rows.filter((report) => report.status !== "Resolved").length;
  const review = rows.filter((report) => report.status === "Under review").length;
  const awaitingAdminReview = rows.filter((report) => report.status === "Awaiting admin review").length;
  const progress = rows.filter((report) => report.status === "In progress" || report.status === "Investigating").length;
  const resolved = rows.filter((report) => report.status === "Resolved").length;
  const displayName = user.name.split(" ")[0];
  const recent = sorted.slice(0, 4);
  const categoryCounts = Object.entries(rows.reduce<Record<string, number>>((acc, report) => { const name = categoryLabel(report.category, locale); acc[name] = (acc[name] || 0) + 1; return acc; }, {}))
    .map(([name, count]) => ({ name: name.replace(" / ", " /\u200b"), count }))
    .sort((a, b) => b.count - a.count).slice(0, 5);
  const languages: Language[] = ["Assamese", "Romanised Assamese", "English", "Mixed"];
  const languageCounts = languages.map((language) => ({ name: languageLabel(language, locale), count: rows.filter((report) => report.originalLanguage === language).length }));
  const activities = rows.flatMap((report) => report.events.map((event) => ({ ...event, report }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  const suggestedCluster = clusters.find((cluster) => cluster.reportIds.some((id) => rows.some((report) => report.id === id)));
  const isAs = locale === "as";
  const greeting = localHour === null
    ? tr(locale, "Hello", "নমস্কাৰ")
    : localHour >= 5 && localHour < 12
      ? tr(locale, "Good morning", "সুপ্ৰভাত")
      : localHour >= 12 && localHour < 17
        ? tr(locale, "Good afternoon", "শুভ দুপৰীয়া")
        : tr(locale, "Good evening", "শুভ সন্ধিয়া");

  if (admin && user.role !== "admin" && !isDemo) return <div className="panel empty-state"><ShieldCheck size={23}/><h3>{tr(locale, "Administrator access required", "প্ৰশাসকৰ অনুমতি প্ৰয়োজন")}</h3><p>{tr(locale, "Sign in with an authorised campus operations account to see the all-campus overview.", "সমগ্ৰ কেম্পাছৰ পৰিচিতি চাবলৈ অনুমোদিত কেম্পাছ পৰিচালনা একাউণ্টেৰে ছাইন ইন কৰক।")}</p><Link href="/login" className="button button-primary button-small">{tr(locale, "Sign in", "ছাইন ইন")}</Link></div>;

  return <div className={`role-dashboard ${admin ? "role-dashboard-admin" : "role-dashboard-citizen"}`}>
    <div className={`page-heading dashboard-heading ${admin ? "dashboard-heading-admin" : "dashboard-heading-citizen"}`}><div><div className="section-kicker">{admin ? tr(locale, "Campus operations · live overview", "কেম্পাছ পৰিচালনা · লাইভ পৰিচিতি") : `${tr(locale, "Your campus", "আপোনাৰ কেম্পাছ")} · ${formatDate(new Date().toISOString(), false, locale)}`}</div><h1>{admin ? tr(locale, "The campus, at a glance.", "কেম্পাছৰ এটা সামগ্ৰিক ছবি।") : `${greeting}, ${displayName}.`}</h1><p>{admin ? tr(locale, "A considered view of open concerns, team activity, and issues moving toward resolution.", "মুকলি সমস্যা, দলৰ কাম আৰু সমাধানৰ দিশে আগবঢ়া প্ৰতিবেদনৰ চিত্ৰ।") : tr(locale, "Here’s where your reports stand. If something needs attention, let us know.", "আপোনাৰ প্ৰতিবেদনসমূহৰ শেহতীয়া স্থিতি ইয়াত চাওক। নতুন সমস্যা থাকিলে আমাক জনাওক।")}</p></div><div className="heading-actions">{admin ? <><PublicIssueBoardToggle/><Link href="/admin/issues" className="button button-outline button-small">{tr(locale, "Open issue desk", "অভিযোগৰ ডেস্ক খোলক")} <ArrowUpRight size={13}/></Link></> : <Link href="/app/new" className="button button-terracotta"><FilePlus2 size={15}/> {tr(locale, "Report an issue", "সমস্যা জনাওক")}</Link>}</div></div>
    {!isDemo && rows.some((report)=>report.isSynthetic) && <div className="demo-banner"><ShieldCheck size={14}/><span>{tr(locale,"This dashboard includes clearly labelled synthetic demonstration reports alongside live records.","এই পৰিচিতিত লাইভ তথ্যৰ লগতে স্পষ্টভাৱে চিহ্নিত কল্পিত ডেম’ প্ৰতিবেদনো আছে।")}</span></div>}
    {!admin && <LatestTracker report={sorted.find((report) => report.status !== "Resolved") || sorted[0]}/>}
    <section className={`metric-row ${admin ? "metric-row-admin" : ""}`} aria-label={tr(locale,"Report summary","প্ৰতিবেদনৰ সাৰাংশ")}>
      <div className="metric"><span className="metric-icon metric-icon-open"><FileText size={19}/></span><div className="metric-copy"><div className="metric-label">{admin ? tr(locale,"Active reports","সক্ৰিয় প্ৰতিবেদন") : tr(locale,"Open reports","মুকলি প্ৰতিবেদন")}</div><div className="metric-value">{open}</div><div className="metric-note">{tr(locale,"Not yet resolved","এতিয়াও সমাধান হোৱা নাই")}</div></div></div>
      <div className="metric"><span className="metric-icon metric-icon-review"><Clock3 size={19}/></span><div className="metric-copy"><div className="metric-label">{tr(locale,"Under review","পৰ্যালোচনাধীন")}</div><div className="metric-value">{review}</div><div className="metric-note">{tr(locale,"Awaiting next action","পৰৱৰ্তী পদক্ষেপৰ অপেক্ষাত")}</div></div></div>
      <div className="metric"><span className="metric-icon metric-icon-progress"><ActivityIcon size={19}/></span><div className="metric-copy"><div className="metric-label">{tr(locale,"In progress","কাম চলি আছে")}</div><div className="metric-value">{progress}</div><div className="metric-note">{tr(locale,"Investigating or being worked on","অনুসন্ধান বা কাম চলি আছে")}</div></div></div>
      <div className="metric"><span className="metric-icon metric-icon-resolved"><CircleCheck size={19}/></span><div className="metric-copy"><div className="metric-label">{tr(locale,"Resolved","সমাধান কৰা হ’ল")}</div><div className="metric-value">{resolved}</div><div className="metric-note">{tr(locale,"Closed with an update","আপডেটসহ বন্ধ কৰা হৈছে")}</div></div></div>
      {admin && <Link href="/admin/issues" className="metric metric-action"><span className="metric-icon metric-icon-awaiting"><ShieldCheck size={19}/></span><div className="metric-copy"><div className="metric-label">{tr(locale,"Awaiting admin review","প্ৰশাসকৰ পৰ্যালোচনাৰ অপেক্ষাত")}</div><div className="metric-value">{awaitingAdminReview}</div><div className="metric-note">{tr(locale,"Staff completion decisions","কৰ্মচাৰীৰ কামৰ সিদ্ধান্ত")}</div></div></Link>}
    </section>
    {admin && <CampusIssueMap/>}
    <div className="dashboard-grid"><div className="dashboard-main">
      <section className="panel"><PanelTitle title={admin ? tr(locale,"Recent reports","শেহতীয়া প্ৰতিবেদন") : tr(locale,"Your recent reports","আপোনাৰ শেহতীয়া প্ৰতিবেদন")} href={admin ? "/admin/issues" : "/app/reports"}/>{recent.length ? <div className="report-list">{recent.map((report) => <ReportRow key={report.id} report={report} showReporter={admin}/>)}</div> : <div className="empty-state"><FilePlus2 size={22}/><h3>{tr(locale,"No reports here yet","ইয়াত এতিয়াও প্ৰতিবেদন নাই")}</h3><p>{tr(locale,"Share a campus concern and we’ll keep its status and updates together for you.","কেম্পাছৰ সমস্যা জনাওক; ইয়াত ইয়াৰ স্থিতি আৰু সকলো আপডেট একেলগে পাব।")}</p><Link className="button button-terracotta button-small" href="/app/new">{tr(locale,"Write your first report","প্ৰথম প্ৰতিবেদন দিয়ক")}</Link></div>}</section>
      <section className="panel" style={{ marginTop: 16 }}><PanelTitle title={admin ? tr(locale,"Reports by category","শ্ৰেণী অনুসৰি প্ৰতিবেদন") : tr(locale,"Updates on your reports","আপোনাৰ প্ৰতিবেদনৰ আপডেট")} href={admin ? "/admin/issues" : undefined}/>{admin ? categoryCounts.length ? <CategoryChart data={categoryCounts} language={locale}/> : <EmptyChart language={locale}/> : activities.length ? <div className="activity-list">{activities.map((activity) => <Activity key={activity.id} report={activity.report} message={activity.message} createdAt={activity.createdAt} language={locale}/>)}</div> : <div className="empty-state" style={{padding:28}}><CircleDot size={19}/><p>{tr(locale,"No status updates yet. When a campus team takes action, you’ll see it here.","এতিয়াও স্থিতিৰ আপডেট নাই। কেম্পাছৰ দলে পদক্ষেপ ল’লে ইয়াত দেখা পাব।")}</p></div>}</section>
    </div><aside className="dashboard-side">
      {admin ? <><section className="panel"><PanelTitle title={tr(locale,"Priority at a glance","অগ্ৰাধিকাৰৰ চিত্ৰ")}/><div className="dashboard-chart"><div className="category-bars">{(["Urgent","High","Medium","Low"] as Priority[]).map((priority) => {const count = rows.filter((report) => (report.confirmedPriority || report.suggestedPriority) === priority && report.status !== "Resolved").length; return <div key={priority}><div className="category-bar-label"><span>{isAs ? ({Urgent:"জৰুৰী",High:"উচ্চ",Medium:"মধ্যম",Low:"কম"}[priority]) : priority}</span><span>{count}</span></div><div className="bar-track"><div className="bar-fill" style={{width: `${open ? (count/open)*100 : 0}%`, background: priority === "Urgent" ? "#b4533d" : priority === "High" ? "#c66a48" : priority === "Medium" ? "#b39a5d" : "#87958c"}}/></div></div>;})}</div></div></section>
        <section className="panel"><PanelTitle title={tr(locale,"Reports by source language","উৎস ভাষা অনুসৰি প্ৰতিবেদন")}/><LanguageDistribution data={languageCounts} total={rows.length}/></section>
        <section className="panel"><PanelTitle title={tr(locale,"Recent clusters","শেহতীয়া ক্লাষ্টাৰ")} href="/admin/clusters" action={tr(locale,"Manage","পৰিচালনা")}/>{clusters.length ? <div className="cluster-list">{clusters.slice(0, 3).map((cluster) => <div className="cluster-item" key={cluster.id}><div className="cluster-top"><h3>{cluster.title}</h3><span className="ticket-code">{cluster.reportIds.length}</span></div><p>{cluster.location} · {categoryLabel(cluster.category, locale)}</p><div className="cluster-languages">{[...new Set(reports.filter((report) => cluster.reportIds.includes(report.id)).map((report) => report.originalLanguage))].map((language) => <span key={language} className="language-tag">{languageLabel(language, locale)}</span>)}</div></div>)}</div> : <div className="empty-state" style={{padding:24}}><p>{tr(locale,"No confirmed issue clusters yet.","এতিয়াও কোনো ক্লাষ্টাৰ নিশ্চিত কৰা হোৱা নাই।")}</p></div>}</section>
        <section className="panel"><PanelTitle title={tr(locale,"Resolution activity","সমাধানৰ কাৰ্যকলাপ")}/><div className="activity-list">{activities.length ? activities.map((activity) => <Activity key={activity.id} report={activity.report} message={activity.message} createdAt={activity.createdAt} language={locale}/>) : <p className="field-hint">{tr(locale,"Status events will appear as teams update reports.","দলে প্ৰতিবেদন আপডেট কৰিলে স্থিতিৰ তথ্য ইয়াত দেখা যাব।")}</p>}</div></section>
      </> : <><section className="panel"><PanelTitle title={tr(locale,"Your next step","আপোনাৰ পৰৱৰ্তী পদক্ষেপ")}/><div className="quick-actions"><Link href="/app/new" className="quick-action"><div className="quick-action-icon"><FilePlus2 size={16}/></div><div><strong>{tr(locale,"Report something new","নতুন সমস্যা জনাওক")}</strong><span>{tr(locale,"Tell us what needs attention","কি কথাত মনোযোগ দিব লাগে জনাওক")}</span></div></Link><Link href="/app/reports" className="quick-action"><div className="quick-action-icon"><MapPin size={16}/></div><div><strong>{tr(locale,"Track an existing report","আগৰ প্ৰতিবেদন অনুসৰণ কৰক")}</strong><span>{tr(locale,"See status and team updates","স্থিতি আৰু দলৰ আপডেট চাওক")}</span></div></Link></div></section>
        {suggestedCluster && <section className="panel"><PanelTitle title={tr(locale,"Connected campus issues","সম্পৰ্কিত কেম্পাছৰ সমস্যা")} href={`/app/reports/${suggestedCluster.reportIds[0]}`} action={tr(locale,"See reports","প্ৰতিবেদন চাওক")}/><div style={{padding:16}}><div className="related-box" style={{marginTop:0}}><div className="related-box-head"><Languages size={13}/> {isDemo ? tr(locale,"Synthetic example","কল্পিত উদাহৰণ") : tr(locale,"Related reports","সম্পৰ্কিত প্ৰতিবেদন")}</div><p>{suggestedCluster.title}</p><div className="field-hint">{suggestedCluster.reportIds.length} {tr(locale,"original reports","মূল প্ৰতিবেদন")} · {suggestedCluster.location}</div></div></div></section>}
        <section className="panel" id="workspace-info"><PanelTitle title={tr(locale,"A better report helps","ভাল প্ৰতিবেদনে সহায় কৰে")}/><div className="quick-actions" style={{paddingTop:13}}><p className="field-hint">{tr(locale,"Include the building, nearby room or floor, and when the issue started. Your original words stay attached to the report.","ভৱন, কোঠা বা মহলা আৰু সমস্যাটো কেতিয়াৰ পৰা হৈছে উল্লেখ কৰক। আপোনাৰ মূল ভাষাৰ কথাখিনি প্ৰতিবেদনৰ সৈতে থাকিব।")}</p><div className="aside-check"><ShieldCheck size={14}/>{tr(locale,"Only you and authorised campus staff can see your private report.","আপুনি আৰু অনুমোদিত কেম্পাছ কৰ্মচাৰীয়েহে আপোনাৰ ব্যক্তিগত প্ৰতিবেদন চাব পাৰে।")}</div></div></section>
      </>}
    </aside></div>
  </div>;
}

function ReportRow({ report, showReporter }: { report: Report; showReporter: boolean }) {
  const { locale, openReport } = useWorkspace();
  return <Link className="report-row" href={`/app/reports/${report.id}`} onClick={(event)=>{event.preventDefault();openReport(report.id);}}><div><h3>{reportTitle(report, locale)}</h3><p>{reportSummary(report, locale)}</p><div className="report-meta"><span className="meta-pill meta-ticket"><span className="meta-pill-label">{tr(locale,"Ticket","টিকিট")}</span>{report.ticketNumber}</span><span className="meta-pill"><MapPin size={10} style={{verticalAlign:"-1px"}}/> {report.building} · {report.area}</span><span className="meta-pill"><Languages size={10} style={{verticalAlign:"-1px"}}/> {languageLabel(report.originalLanguage, locale)}</span>{showReporter && <span className="meta-pill"><span className="meta-pill-label">{tr(locale,"By","দ্বাৰা")}</span>{report.reporterName}</span>}{report.isSynthetic&&<span className="language-tag">{tr(locale,"Synthetic demo","কল্পিত ডেম’")}</span>}<span className="meta-pill"><span className="meta-pill-label">{tr(locale,"Updated","আপডেট")}</span>{timeAgo(report.createdAt, locale)}</span></div></div><div style={{display:"grid",justifyItems:"end",gap:6,alignContent:"start"}}><StatusPill status={report.status} language={locale}/><PriorityPill priority={report.confirmedPriority || report.suggestedPriority} language={locale}/></div></Link>;
}

function Activity({ report, message, createdAt, language }: { report: Report; message: string; createdAt: string; language: "en" | "as" }) {
  return <div className="activity-item"><div className="activity-line"><i className="activity-dot"/></div><div className="activity-text"><strong>{report.ticketNumber}</strong> · {message}<div className="activity-time">{timeAgo(createdAt, language)} · {reportTitle(report, language)}</div></div></div>;
}

function CategoryChart({ data, language }: { data: {name:string; count:number}[]; language: "en" | "as" }) {
  return <div style={{width:"100%",height:224,padding:"15px 9px 5px"}}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{left:4,right:15,top:2,bottom:2}} barSize={13}><CartesianGrid horizontal={false} stroke="#e8e6de"/><XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize:9,fill:"#899188"}} allowDecimals={false}/><YAxis type="category" dataKey="name" width={122} axisLine={false} tickLine={false} tick={{fontSize:9,fill:"#667168"}}/><Tooltip cursor={{fill:"#f1f0e9"}} contentStyle={{border:"1px solid #deddd5",borderRadius:2,fontSize:10,background:"#faf9f5"}}/><Bar dataKey="count" name={tr(language,"Reports","প্ৰতিবেদন")} radius={[0,2,2,0]}>{data.map((entry,index)=><Cell key={entry.name} fill={index===0?"#c66a48":"#7d9080"}/>)}</Bar></BarChart></ResponsiveContainer></div>;
}

function LanguageDistribution({ data, total }: { data: {name:string;count:number}[]; total:number }) {
  const { locale } = useWorkspace();
  const colors = ["#c66a48", "#d5b96b", "#6f8273", "#9ea69b"];
  return <div className="language-distribution">{data.map((item,index)=><div className="language-distribution-row" key={item.name}><div className="language-distribution-label"><span><i style={{background:colors[index]}}/>{item.name}</span><strong>{item.count}</strong></div><div className="bar-track"><div className="bar-fill" style={{width:`${total ? item.count/total*100 : 0}%`,background:colors[index]}}/></div></div>)}<p className="field-hint">{tr(locale,"Language detected from the original submission.","মূল প্ৰতিবেদনৰ পৰা চিনাক্ত কৰা ভাষা।")}</p></div>;
}

function EmptyChart({ language }: { language: "en" | "as" }) { return <div className="empty-state" style={{padding:25}}><Sparkles size={18}/><p>{tr(language,"Category trends will appear when reports are submitted.","প্ৰতিবেদন দাখিল হ’লে শ্ৰেণীৰ পৰিসংখ্যা দেখা যাব।")}</p></div>; }

function LatestTracker({ report }: { report?: Report }) {
  const { locale, openReport } = useWorkspace();
  if (!report) return null;
  const stage = report.status === "Resolved" ? 3 : report.status === "Under review" ? 1 : ["In progress", "Investigating", "Awaiting admin review"].includes(report.status) ? 2 : 0;
  const steps = [tr(locale, "Reported", "দাখিল"), tr(locale, "Under review", "পৰ্যালোচনা"), tr(locale, "In progress", "কাম চলি আছে"), tr(locale, "Resolved", "সমাধান")];
  return <section className="tracker" aria-label={tr(locale, "Latest report progress", "শেহতীয়া প্ৰতিবেদনৰ অগ্ৰগতি")}><div><small>{tr(locale, "Latest report", "শেহতীয়া প্ৰতিবেদন")}</small><span className="ticket-code">{report.ticketNumber}</span><h2>{reportTitle(report, locale)}</h2><p>{report.building} · {timeAgo(report.createdAt, locale)}</p><button type="button" className="button button-primary button-small" onClick={() => openReport(report.id)}>{tr(locale, "Open report", "প্ৰতিবেদন খোলক")} <ArrowRight size={13}/></button></div><ol className="tracker-steps">{steps.map((label, index) => <li key={label} className={index < stage ? "done" : index === stage ? "now" : ""} aria-current={index === stage ? "step" : undefined}><i/>{label}</li>)}</ol></section>;
}
