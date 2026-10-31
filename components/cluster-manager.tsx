"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, GitBranch, Languages, MapPin, Search, Sparkles, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace-provider";
import { StatusPill } from "@/components/report-ui";
import { statuses, type Report, type SimilarReport } from "@/lib/types";
import { categoryLabel, languageLabel, reportTitle, statusLabel, tr } from "@/lib/i18n";

export function ClusterManager() {
  const { clusters, reports, user, locale, createCluster, updateCluster } = useWorkspace();
  const [activeReportId, setActiveReportId] = useState("");
  const [matches, setMatches] = useState<SimilarReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const canAdmin = user.role === "admin";
  const activeReport = reports.find((report) => report.id === activeReportId);
  const unclustered = useMemo(() => reports.filter((report)=>!report.clusterId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),[reports]);

  useEffect(()=>{
    if(!activeReport){setMatches([]);return;}
    let current=true;
    setLoading(true);
    fetch(`/api/reports/${activeReport.id}/similar`,{cache:"no-store"}).then(async(response)=>{if(response.ok){const body=await response.json() as {matches:SimilarReport[]};if(current)setMatches(body.matches.filter((item)=>!item.report.clusterId));}}).catch(()=>{if(current)setMatches([]);}).finally(()=>{if(current)setLoading(false);});
    return ()=>{current=false;};
  },[activeReport]);

  async function confirmMatch(match:SimilarReport){if(!activeReport)return;setBusy(match.report.id);try{await createCluster(`${activeReport.building} · ${reportTitle(activeReport,locale)}`,[activeReport.id,match.report.id]);toast.success(tr(locale,"Reports confirmed in one issue cluster.","প্ৰতিবেদনসমূহ এটা সমস্যা ক্লাষ্টাৰত নিশ্চিত কৰা হ’ল।"));setActiveReportId("");setMatches([]);}catch(error){toast.error(error instanceof Error?error.message:tr(locale,"Could not confirm this relationship.","এই সম্পৰ্ক নিশ্চিত কৰিব পৰা নগ’ল।"));}finally{setBusy("");}}
  async function update(id:string,update:Parameters<typeof updateCluster>[1],message?:string){setBusy(id);try{await updateCluster(id,update,undefined,message);toast.success(tr(locale,"Cluster updated.","ক্লাষ্টাৰ আপডেট কৰা হ’ল।"));}catch(error){toast.error(error instanceof Error?error.message:tr(locale,"Could not update the cluster.","ক্লাষ্টাৰ আপডেট কৰিব পৰা নগ’ল।"));}finally{setBusy("");}}
  async function separate(clusterId:string,reportId:string){setBusy(reportId);try{await updateCluster(clusterId,{},reportId);toast.success(tr(locale,"Report separated. Its original submission is unchanged.","প্ৰতিবেদনটো পৃথক কৰা হ’ল। মূল দাখিল সলনি হোৱা নাই।"));}catch(error){toast.error(error instanceof Error?error.message:tr(locale,"Could not separate this report.","এই প্ৰতিবেদন পৃথক কৰিব পৰা নগ’ল।"));}finally{setBusy("");}}
  async function resolveCluster(clusterId:string){const note=resolutionNotes[clusterId]?.trim();if(!note||note.length<8){toast.error(tr(locale,"Add a short resolution note before closing this cluster.","ক্লাষ্টাৰ বন্ধ কৰাৰ আগতে সমাধানৰ এটা চমু টোকা দিয়ক।"));return;}await update(clusterId,{status:"Resolved"},note);setResolutionNotes((previous)=>({...previous,[clusterId]:""}));}

  if(!canAdmin)return <div className="panel empty-state"><UsersRound size={21}/><h3>{tr(locale,"Administrator access required","প্ৰশাসকৰ অনুমতি প্ৰয়োজন")}</h3><p>{tr(locale,"Sign in with an authorised campus operations account to manage confirmed issue clusters.","নিশ্চিত সমস্যা ক্লাষ্টাৰ পৰিচালনা কৰিবলৈ অনুমোদিত কেম্পাছ পৰিচালনা একাউণ্টেৰে ছাইন ইন কৰক।")}</p></div>;

  return <>
    <div className="page-heading"><div><div className="section-kicker">{tr(locale,"Administrator workspace · Related reports","প্ৰশাসকৰ ৱৰ্কস্পেচ · সম্পৰ্কিত প্ৰতিবেদন")}</div><h1>{tr(locale,"Issue clusters","সমস্যাৰ ক্লাষ্টাৰ")}</h1><p>{tr(locale,"Bring reports together when the original submissions describe one campus issue.","মূল প্ৰতিবেদনসমূহে একেটা কেম্পাছ সমস্যাৰ কথা ক’লে সেইবোৰ একেলগ কৰক।")}</p></div><div className="heading-actions"><span className="status-pill status-progress"><UsersRound size={11}/>{clusters.length} {tr(locale,"confirmed groups","টা নিশ্চিত গোট")}</span></div></div>
    <section className="panel" style={{marginBottom:18}}>
      <div className="panel-head"><div><h2>{tr(locale,"Review a possible relationship","সম্ভাৱ্য সম্পৰ্ক পৰ্যালোচনা কৰক")}</h2><div className="field-hint" style={{marginTop:5}}>{tr(locale,"A similarity score is a lead for review, never a decision. Original reports remain separate records.","সদৃশতাৰ নম্বৰ কেৱল পৰ্যালোচনাৰ বাবে এটা ইংগিত, চূড়ান্ত সিদ্ধান্ত নহয়। মূল প্ৰতিবেদনসমূহ পৃথককৈ থাকে।")}</div></div><span className="section-kicker">{tr(locale,"Human confirmation","মানৱীয় নিশ্চিতকৰণ")}</span></div>
      <div className="cluster-review-grid">
        <div className="field" style={{margin:0}}><label htmlFor="compare-report">{tr(locale,"Choose an ungrouped report","এতিয়াও গোট নকৰা প্ৰতিবেদন বাছক")}</label><select id="compare-report" value={activeReportId} onChange={(event)=>setActiveReportId(event.target.value)}><option value="">{tr(locale,"Select a report to compare","তুলনা কৰিবলৈ প্ৰতিবেদন বাছক")}</option>{unclustered.map((report)=><option key={report.id} value={report.id}>{report.ticketNumber} · {reportTitle(report,locale)}</option>)}</select><span className="field-hint">{unclustered.length} {tr(locale,"reports are not in a confirmed cluster.","টা প্ৰতিবেদন এতিয়াও নিশ্চিত ক্লাষ্টাৰত নাই।")}</span></div>
        <div>
          {!activeReport ? <div className="empty-state" style={{padding:14}}><Search size={17}/><p>{tr(locale,"Select a report to review potential cross-language matches.","ভাষাসমূহৰ মাজৰ সম্ভাৱ্য মিল পৰ্যালোচনা কৰিবলৈ প্ৰতিবেদন বাছক।")}</p></div> : <>
            <div className="related-box" style={{margin:0}}><div className="related-box-head"><Sparkles size={13}/> {tr(locale,"Original report · source language","মূল প্ৰতিবেদন · উৎস ভাষা")} · {languageLabel(activeReport.originalLanguage,locale)}</div><p className={activeReport.originalLanguage==="Assamese"?"assamese":""} lang={activeReport.originalLanguage==="Assamese"?"as":activeReport.originalLanguage==="Romanised Assamese"?"as-Latn":"en"}>{activeReport.originalText}</p><div className="field-hint"><MapPin size={11} style={{verticalAlign:"-2px"}}/> {activeReport.building} · {activeReport.area} · {categoryLabel(activeReport.category,locale)}</div></div>
            {loading && <p className="field-hint" style={{marginTop:12}}>{tr(locale,"Checking active reports with Gemini Embedding 2…","Gemini Embedding 2-ৰ সহায়ত সক্ৰিয় প্ৰতিবেদন পৰীক্ষা কৰা হৈছে…")}</p>}
            {matches.length ? matches.map((match)=><div key={match.report.id} className="related-match" style={{marginTop:10}}><div className="match-head"><div><div className="section-kicker">{tr(locale,"Potential match","সম্ভাৱ্য মিল")} · {match.report.ticketNumber}</div><div className="match-report" style={{marginTop:7}}><strong className={match.report.originalLanguage==="Assamese"?"assamese":""} lang={match.report.originalLanguage==="Assamese"?"as":match.report.originalLanguage==="Romanised Assamese"?"as-Latn":"en"}>{match.report.originalText}</strong><span>{languageLabel(match.report.originalLanguage,locale)} · {match.report.building} · {categoryLabel(match.report.category,locale)}</span></div></div><div className="match-score">{Math.round(match.score*100)}%</div></div><p className="match-reason">{locale==="as"?match.explanationAs:match.explanation}</p><button className="button button-outline button-small" disabled={!!busy} onClick={()=>void confirmMatch(match)}><Check size={12}/>{busy===match.report.id?tr(locale,"Confirming…","নিশ্চিত কৰা হৈছে…"):tr(locale,"Confirm and create cluster","নিশ্চিত কৰি ক্লাষ্টাৰ সৃষ্টি কৰক")}</button></div>) : !loading ? <div className="empty-state" style={{padding:15}}><GitBranch size={16}/><p>{tr(locale,"No active reports meet the current similarity threshold. Try another report after new submissions arrive.","বৰ্তমানৰ সদৃশতাৰ সীমাত কোনো সক্ৰিয় প্ৰতিবেদন নাই। নতুন প্ৰতিবেদন আহিলে পুনৰ চেষ্টা কৰক।")}</p></div> : null}
          </>}
        </div>
      </div>
    </section>
    <div className="page-heading" style={{marginBottom:14}}><div><div className="section-kicker">{tr(locale,"Confirmed relationships","নিশ্চিত সম্পৰ্ক")}</div><h2 style={{font:"400 24px var(--serif)",margin:"6px 0 0"}}>{tr(locale,"Managed issue groups","পৰিচালিত সমস্যা গোট")}</h2></div></div>
    {clusters.length ? <div className="cluster-grid">{clusters.map((cluster)=>{
      const members=reports.filter((report)=>cluster.reportIds.includes(report.id));
      const clusterLanguages=[...new Set(members.map((report)=>report.originalLanguage))];
      return <article className="cluster-card" key={cluster.id}>
        <div className="cluster-card-head"><div><div className="section-kicker">{categoryLabel(cluster.category,locale)}</div><h2>{cluster.title}</h2><p><MapPin size={11} style={{verticalAlign:"-1px"}}/> {cluster.location} · {members.length} {tr(locale,"reports","টা প্ৰতিবেদন")}</p></div><StatusPill status={cluster.status} language={locale}/></div>
        <div className="cluster-summary">{clusterLanguages.map((item)=><span className="language-tag" key={item}><Languages size={9} style={{verticalAlign:"-1px"}}/> {languageLabel(item,locale)}</span>)}<span className="language-tag">{cluster.assignedTo||tr(locale,"Unassigned","দায়িত্ব দিয়া হোৱা নাই")}</span></div>
        <div className="cluster-reports">{members.map((report)=><div className="cluster-report" key={report.id}><div><strong>{report.ticketNumber} · {languageLabel(report.originalLanguage,locale)}</strong><span className={report.originalLanguage==="Assamese"?"assamese":""} lang={report.originalLanguage==="Assamese"?"as":report.originalLanguage==="Romanised Assamese"?"as-Latn":"en"}>{report.originalText}</span><span>{report.reporterName} · {report.building} · {report.area}</span></div><button className="button button-outline button-small" disabled={!!busy} onClick={()=>void separate(cluster.id,report.id)}>{tr(locale,"Separate","পৃথক কৰক")}</button></div>)}</div>
        <div className="cluster-actions"><label className="field" style={{margin:0,flex:1}}><span className="visually-hidden">{tr(locale,"Cluster status","ক্লাষ্টাৰৰ স্থিতি")}</span><select aria-label={`${tr(locale,"Status for","স্থিতি")} ${cluster.title}`} value={cluster.status} onChange={(event)=>void update(cluster.id,{status:event.target.value as Report["status"]})}>{statuses.map((item)=><option key={item} value={item}>{statusLabel(item,locale)}</option>)}</select></label><label className="field" style={{margin:0,flex:1}}><span className="visually-hidden">{tr(locale,"Assigned team","দায়িত্বত থকা দল")}</span><input aria-label={`${tr(locale,"Assigned team for","দল")} ${cluster.title}`} defaultValue={cluster.assignedTo||""} placeholder={tr(locale,"Assign team","দলক দায়িত্ব দিয়ক")} onBlur={(event)=>{const value=event.target.value.trim()||null;if(value!==cluster.assignedTo)void update(cluster.id,{assignedTo:value});}}/></label></div>
        {cluster.status!=="Resolved"&&<div className="cluster-resolution"><label htmlFor={`resolution-${cluster.id}`}>{tr(locale,"Resolution note","সমাধানৰ টোকা")}</label><textarea id={`resolution-${cluster.id}`} maxLength={1000} value={resolutionNotes[cluster.id]||""} onChange={(event)=>setResolutionNotes((previous)=>({...previous,[cluster.id]:event.target.value}))} placeholder={tr(locale,"Describe the repair or action completed for all reports in this group…","এই গোটৰ সকলো প্ৰতিবেদনৰ বাবে কৰা মেৰামতি বা পদক্ষেপৰ বিৱৰণ দিয়ক…")}/><button className="button button-primary button-small" disabled={!!busy} onClick={()=>void resolveCluster(cluster.id)}>{tr(locale,"Resolve cluster and notify reporters","ক্লাষ্টাৰ সমাধান কৰি প্ৰতিবেদন দিওঁতাক জনাওক")}</button></div>}
      </article>;
    })}</div> : <div className="panel empty-state"><UsersRound size={21}/><h3>{tr(locale,"No confirmed clusters","কোনো নিশ্চিত ক্লাষ্টাৰ নাই")}</h3><p>{tr(locale,"When reports describe the same issue, review the suggestion and confirm a group. Each original report stays available to its reporter.","প্ৰতিবেদনসমূহে একে সমস্যাৰ কথা ক’লে পৰামৰ্শ পৰ্যালোচনা কৰি গোট নিশ্চিত কৰক। প্ৰতিজন প্ৰতিবেদন দিওঁতাৰ মূল প্ৰতিবেদন তেওঁলোকৰ বাবে উপলব্ধ থাকিব।")}</p><Link className="button button-outline button-small" href="/admin/issues">{tr(locale,"Choose reports in the issue desk","অভিযোগৰ ডেস্কত প্ৰতিবেদন বাছক")}</Link></div>}
  </>;
}
