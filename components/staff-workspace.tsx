"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, FilePlus2, Layers3, Search, ShieldCheck } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PriorityPill, StatusPill } from "@/components/report-ui";
import { categoryLabel, languageLabel, reportSummary, reportTitle, statusLabel, tr } from "@/lib/i18n";
import { timeAgo } from "@/lib/format";
import type { Category, Report, ReportStatus } from "@/lib/types";
import { CampusIssueMap } from "@/components/campus-issue-map";

const workStatuses: Array<ReportStatus | "All work"> = ["All work", "Under review", "Investigating", "In progress", "Awaiting admin review"];
type StaffCluster = { id: string; title: string; category: string; location: string; reports: Array<{ id: string; ticket_number: string; title_en: string | null; title_as: string | null; summary_en: string | null; summary_as: string | null; category: string; suggested_priority: Report["suggestedPriority"]; confirmed_priority: Report["suggestedPriority"] | null; status: ReportStatus; location_building: string; location_area: string }> };

export function StaffWorkspace() {
  const { user, reports, locale, isDemo, openReport } = useWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ReportStatus | "All work">("All work");
  const [clusters, setClusters] = useState<StaffCluster[]>([]);
  const [clusterError, setClusterError] = useState("");
  useEffect(() => {
    if (!user.department || isDemo) return;
    let active = true;
    fetch("/api/staff/clusters", { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Confirmed issue clusters could not be loaded.");
      if (active) setClusters(body.clusters || []);
    }).catch((error) => { if (active) setClusterError(error instanceof Error ? error.message : "Confirmed issue clusters could not be loaded."); });
    return () => { active = false; };
  }, [user.department, isDemo]);
  const assigned = useMemo(() => reports
    .filter((report) => Boolean(user.department) && report.assignedDepartment === user.department && report.status !== "Resolved")
    .filter((report) => status === "All work" || report.status === status)
    .filter((report) => `${report.ticketNumber} ${report.titleEn} ${report.titleAs} ${report.building} ${report.area} ${report.originalText}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [reports, user.department, status, search]);
  const departmentReports = reports.filter((report) => Boolean(user.department) && report.assignedDepartment === user.department && report.status !== "Resolved");
  const reviewCount = departmentReports.filter((report) => report.status === "Awaiting admin review").length;
  const progressCount = departmentReports.filter((report) => report.status === "In progress").length;
  const newCount = departmentReports.filter((report) => report.status === "Under review" || report.status === "Investigating").length;

  return <>
    <div className="page-heading"><div><div className="section-kicker">{tr(locale, "Staff workspace", "কৰ্মচাৰীৰ ৱৰ্কস্পেচ")}</div><h1>{tr(locale, "Your department’s work", "আপোনাৰ বিভাগৰ কাম")}</h1><p>{tr(locale, "Move assigned campus issues forward and send completed work to an administrator for review.", "আপোনাৰ বিভাগক দিয়া কেম্পাছৰ সমস্যাসমূহ আগবঢ়াওক আৰু সম্পূৰ্ণ কাম প্ৰশাসকৰ পৰ্যালোচনালৈ পঠিয়াওক।")}</p></div><Link className="button button-terracotta" href="/app/new"><FilePlus2 size={16}/>{tr(locale, "Report an issue", "সমস্যা জনাওক")}</Link></div>
    <div className="staff-identity"><div className="staff-identity-mark"><BriefcaseBusiness size={20}/></div><div><span>{tr(locale, "Assigned department", "দায়িত্বত থকা বিভাগ")}</span><strong>{user.department || tr(locale, "No department assigned", "বিভাগ দিয়া হোৱা নাই")}</strong></div><span className="staff-identity-note"><ShieldCheck size={14}/>{tr(locale, "Only assigned reports are shown", "কেৱল দায়িত্ব দিয়া প্ৰতিবেদন দেখুওৱা হয়")}</span></div>
    {!user.department && <section className="panel" role="status" style={{ marginBottom: 16 }}><div className="section-kicker">{tr(locale, "Staff account setup", "কৰ্মচাৰী একাউণ্টৰ ছেটআপ")}</div><h2>{tr(locale, "A department assignment is needed", "এটা বিভাগ নিৰ্ধাৰণ কৰিব লাগিব")}</h2><p>{tr(locale, "Your account has the staff role, but no campus department is assigned yet. Ask a campus administrator to assign your department in Team access. Reports will appear after an administrator assigns them to that same department.", "আপোনাৰ একাউণ্টত কৰ্মচাৰীৰ ভূমিকা আছে, কিন্তু এতিয়াও কোনো কেম্পাছ বিভাগ দিয়া হোৱা নাই। কেম্পাছৰ প্ৰশাসকক Team access-ত আপোনাৰ বিভাগ নিৰ্ধাৰণ কৰিবলৈ কওক। প্ৰশাসকে সেই একে বিভাগলৈ প্ৰতিবেদন দিয়াৰ পিছত ইয়াত দেখা যাব।")}</p></section>}
    <div className="staff-metrics">
      <article><span>{tr(locale, "New & investigating", "নতুন আৰু অনুসন্ধান চলি থকা")}</span><strong>{newCount}</strong><small>{tr(locale, "Ready for staff action", "কৰ্মচাৰীৰ পদক্ষেপৰ বাবে সাজু")}</small></article>
      <article><span>{tr(locale, "Work in progress", "কাম চলি আছে")}</span><strong>{progressCount}</strong><small>{tr(locale, "Active in your department", "আপোনাৰ বিভাগত চলি আছে")}</small></article>
      <article className={reviewCount ? "needs-review" : ""}><span>{tr(locale, "With administrators", "প্ৰশাসকৰ ওচৰত")}</span><strong>{reviewCount}</strong><small>{tr(locale, "Waiting for a review decision", "পৰ্যালোচনাৰ সিদ্ধান্তৰ অপেক্ষাত")}</small></article>
    </div>
    {!isDemo && user.department && <CampusIssueMap/>}
    {!isDemo && user.department && <section className="staff-clusters panel">
      <div className="staff-queue-heading"><div><div className="section-kicker">{tr(locale, "Administrator confirmed", "প্ৰশাসকে নিশ্চিত কৰিছে")}</div><h2>{tr(locale, "Issue clusters", "সমস্যাৰ ক্লাষ্টাৰ")}</h2></div><span>{clusters.length} {tr(locale, "active clusters", "টা সক্ৰিয় ক্লাষ্টাৰ")}</span></div>
      {clusterError ? <p className="field-hint" role="status">{clusterError}</p> : clusters.length ? <div className="staff-cluster-grid">{clusters.map((cluster) => <article className="staff-cluster-card" key={cluster.id}>
        <div className="staff-cluster-heading"><span className="staff-cluster-icon"><Layers3 size={17}/></span><div><strong>{cluster.title}</strong><small>{categoryLabel(cluster.category as Category, locale)} · {cluster.location}</small></div><span className="staff-cluster-count">{cluster.reports.length}</span></div>
        <div className="staff-cluster-members">{cluster.reports.map((member) => <button className="staff-cluster-member" type="button" key={member.id} onClick={() => openReport(member.id)}><span><b>{member.ticket_number}</b><strong>{locale === "as" ? member.title_as || member.title_en : member.title_en || member.title_as}</strong><small>{member.location_building}{member.location_area ? ` · ${member.location_area}` : ""}</small></span><span className="staff-cluster-state"><StatusPill status={member.status} language={locale}/><PriorityPill priority={member.confirmed_priority || member.suggested_priority as Report["suggestedPriority"]} language={locale}/><ArrowUpRight size={14}/></span></button>)}</div>
      </article>)}</div> : <div className="empty-state staff-empty"><Layers3 size={23}/><h3>{tr(locale, "No confirmed clusters for your department", "আপোনাৰ বিভাগৰ বাবে নিশ্চিত ক্লাষ্টাৰ নাই")}</h3><p>{tr(locale, "When an administrator confirms that reports describe the same issue, they will be grouped here while unresolved.", "প্ৰশাসকে একাধিক প্ৰতিবেদন একে সমস্যা বুলি নিশ্চিত কৰিলে, সমাধান নোহোৱালৈকে ইয়াত একেলগে দেখা যাব।")}</p></div>}
    </section>}
    <section className="staff-queue panel">
      <div className="staff-queue-heading"><div><div className="section-kicker">{tr(locale, "Assigned to your department", "আপোনাৰ বিভাগক দিয়া হৈছে")}</div><h2>{tr(locale, "Service queue", "সেৱাৰ শাৰী")}</h2></div><span>{assigned.length} {tr(locale, "open issues", "টা খোলা সমস্যা")}</span></div>
      <div className="staff-queue-tools"><div className="search-field"><Search size={16}/><input aria-label={tr(locale, "Search assigned reports", "দায়িত্ব দিয়া প্ৰতিবেদন বিচাৰক")} placeholder={tr(locale, "Search ticket, issue, or location", "টিকিট, সমস্যা বা স্থান বিচাৰক")} value={search} onChange={(event) => setSearch(event.target.value)}/></div><select className="filter-select" aria-label={tr(locale, "Filter assigned reports by status", "স্থিতি অনুসৰি দায়িত্ব দিয়া প্ৰতিবেদন ফিল্টাৰ কৰক")} value={status} onChange={(event) => setStatus(event.target.value as ReportStatus | "All work")}>
        {workStatuses.map((item) => <option key={item} value={item}>{item === "All work" ? tr(locale, "All open work", "সকলো খোলা কাম") : statusLabel(item, locale)}</option>)}
      </select></div>
      {assigned.length ? <div className="staff-report-list">{assigned.map((report) => <button key={report.id} className="staff-report-card" type="button" onClick={() => openReport(report.id)}>
        <div className="staff-report-main"><div className="staff-report-ticket">{report.ticketNumber}<span>{languageLabel(report.originalLanguage, locale)}</span></div><h3>{reportTitle(report, locale)}</h3><p>{reportSummary(report, locale)}</p><small>{report.building}{report.area ? ` · ${report.area}` : ""} · {timeAgo(report.updatedAt, locale)}</small></div>
        <div className="staff-report-state"><StatusPill status={report.status} language={locale}/><PriorityPill priority={report.confirmedPriority || report.suggestedPriority} language={locale}/><span className="staff-open-label">{tr(locale, "Open report", "প্ৰতিবেদন খোলক")} <ArrowUpRight size={14}/></span></div>
      </button>)}</div> : <div className="empty-state staff-empty"><BriefcaseBusiness size={24}/><h3>{tr(locale, "No reports in this view", "এই দৃশ্যত কোনো প্ৰতিবেদন নাই")}</h3><p>{isDemo ? tr(locale, "Choose the staff demonstration role to explore assigned work, or adjust your search and status filters.", "দায়িত্ব দিয়া কাম চাবলৈ কৰ্মচাৰীৰ ডেম’ ভূমিকা বাছক, অথবা বিচাৰ আৰু স্থিতিৰ ফিল্টাৰ সলনি কৰক।") : tr(locale, "New work appears here when an administrator assigns a report to your department.", "প্ৰশাসকে আপোনাৰ বিভাগক প্ৰতিবেদন দিলে নতুন কাম ইয়াত দেখা যাব।")}</p></div>}
    </section>
    {isDemo && <p className="field-hint staff-demo-note">{tr(locale, "Synthetic walkthrough: open the in-progress hostel water report, add a work note, then submit it for administrator review.", "কল্পিত প্ৰদৰ্শনী: হোষ্টেলৰ পানীৰ চলি থকা কামটো খোলক, কামৰ টোকা দিয়ক আৰু প্ৰশাসকৰ পৰ্যালোচনালৈ পঠিয়াওক।")}</p>}
  </>;
}
