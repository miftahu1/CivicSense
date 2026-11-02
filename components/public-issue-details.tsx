"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Check, Circle, Clock3, MapPin, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageToggle } from "@/components/language-toggle";
import { useWorkspace } from "@/components/workspace-provider";
import { PriorityPill, StatusPill } from "@/components/report-ui";
import { categoryLabel, statusLabel, tr } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import type { Category, Priority, ReportStatus } from "@/lib/types";

type PublicDetail = { ticketNumber: string; titleEn: string; titleAs: string; summaryEn: string; summaryAs: string; category: Category; priority: Priority; building: string; area: string; status: ReportStatus; createdAt: string; updatedAt: string; updates: { status: ReportStatus; createdAt: string }[] };

export function PublicIssueDetails() {
  const { locale } = useWorkspace();
  const params = useParams<{ ticketNumber: string }>();
  const ticketNumber = decodeURIComponent(params.ticketNumber);
  const [report, setReport] = useState<PublicDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/public/issues/${encodeURIComponent(ticketNumber)}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load this report.");
      setReport(body.report as PublicDetail);
    }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "Unable to load this report.");
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [ticketNumber]);

  const currentStep = report?.status === "Resolved" ? 3 : report && ["Investigating", "In progress", "Awaiting admin review"].includes(report.status) ? 2 : 1;
  const title = report && (locale === "as" ? report.titleAs : report.titleEn);
  const summary = report && (locale === "as" ? report.summaryAs : report.summaryEn);
  const milestones = report ? [
    { label: tr(locale, "Reported", "জনোৱা হৈছে"), date: report.createdAt, complete: true },
    { label: tr(locale, "Under review", "পৰ্যালোচনাধীন"), date: report.updates.find((event) => event.status === "Under review")?.createdAt || (currentStep >= 1 ? report.createdAt : undefined), complete: currentStep >= 1 },
    { label: tr(locale, "In progress", "কাম চলি আছে"), date: report.updates.find((event) => ["Investigating", "In progress", "Awaiting admin review"].includes(event.status))?.createdAt || (currentStep >= 2 ? report.updatedAt : undefined), complete: currentStep >= 2 },
    { label: tr(locale, "Resolved", "সমাধান হৈছে"), date: report.updates.find((event) => event.status === "Resolved")?.createdAt || (report.status === "Resolved" ? report.updatedAt : undefined), complete: currentStep >= 3 },
  ] : [];

  return <main className="public-issues-page public-detail-page"><header className="public-issues-nav"><Brand href="/"/><div className="public-issues-nav-actions"><LanguageToggle/><Link className="button button-outline button-small" href="/issues"><ArrowLeft size={14}/>{tr(locale, "All issues", "সকলো সমস্যা")}</Link></div></header>
    <div className="public-detail-wrap"><Link className="public-back-link" href="/issues"><ArrowLeft size={14}/>{tr(locale, "Back to public issue board", "ৰাজহুৱা সমস্যা ফলকলৈ উভতি যাওক")}</Link>
      {loading ? <div className="public-detail-loading"><span className="public-loading-mark"/><p>{tr(locale, "Loading report details…", "প্ৰতিবেদনৰ তথ্য লোড হৈছে…")}</p></div> : error || !report ? <div className="public-issues-empty"><h2>{tr(locale, "This report is unavailable", "এই প্ৰতিবেদন উপলব্ধ নহয়")}</h2><p>{error || tr(locale, "It may have been made private or removed from the public board.", "ইয়াক ব্যক্তিগত কৰা হৈছে বা ৰাজহুৱা ফলকৰ পৰা আঁতৰোৱা হৈছে।")}</p><Link href="/issues" className="button button-outline button-small">{tr(locale, "Return to issue board", "সমস্যা ফলকলৈ উভতি যাওক")}</Link></div> : <>
        <div className="public-detail-heading"><div><div className="section-kicker">{report.ticketNumber} · {tr(locale, "Public issue update", "ৰাজহুৱা সমস্যা আপডেট")}</div><h1>{title}</h1><p>{summary}</p></div><div className="public-detail-badges"><StatusPill status={report.status} language={locale}/><PriorityPill priority={report.priority} language={locale}/></div></div>
        <div className="public-detail-grid"><div className="public-detail-main">
          <section className="public-detail-card"><div className="section-kicker">{tr(locale, "Progress so far", "এতিয়ালৈকে অগ্ৰগতি")}</div><h2>{tr(locale, "From report to resolution", "প্ৰতিবেদনৰ পৰা সমাধানলৈ")}</h2><div className="public-detail-timeline">{milestones.map((item, index) => <div className={`public-detail-milestone${item.complete ? " is-complete" : ""}${index === currentStep ? " is-current" : ""}`} key={item.label}><span className="public-timeline-node">{item.complete ? <Check size={14}/> : <Circle size={13}/>}</span><div><strong>{item.label}</strong><small>{item.date ? formatDate(item.date, false, locale) : tr(locale, "Not reached yet", "এতিয়াও হোৱা নাই")}</small></div></div>)}</div><p className="public-detail-status-note"><Clock3 size={15}/>{report.status === "Resolved" ? tr(locale, "This issue has been marked resolved by the campus team.", "কেম্পাছৰ দলে এই সমস্যাটো সমাধান হোৱা বুলি চিহ্নিত কৰিছে।") : report.status === "Under review" ? tr(locale, "The report has been received and is awaiting review.", "প্ৰতিবেদন গ্ৰহণ কৰা হৈছে আৰু পৰ্যালোচনাৰ অপেক্ষাত আছে।") : tr(locale, "The campus team is working on this issue.", "কেম্পাছৰ দলে এই সমস্যাটোৰ কাম কৰি আছে।")}</p></section>
          <section className="public-detail-card"><div className="section-kicker">{tr(locale, "Public update history", "ৰাজহুৱা আপডেটৰ ইতিহাস")}</div><h2>{tr(locale, "Status changes", "স্থিতিৰ পৰিৱৰ্তন")}</h2>{report.updates.length ? <ol className="public-update-list">{report.updates.map((event, index) => <li key={`${event.status}-${event.createdAt}-${index}`}><span><Check size={12}/></span><div><strong>{statusLabel(event.status, locale)}</strong><time>{formatDate(event.createdAt, true, locale)}</time></div></li>)}</ol> : <p className="public-muted">{tr(locale, "No public status changes have been recorded yet.", "এতিয়ালৈকে কোনো ৰাজহুৱা স্থিতি পৰিৱৰ্তন নথিভুক্ত হোৱা নাই।")}</p>}</section>
        </div><aside className="public-detail-card public-detail-aside"><div className="section-kicker">{tr(locale, "Issue at a glance", "সমস্যাৰ চমু তথ্য")}</div><div className="public-detail-fact"><span>{tr(locale, "Current status", "বৰ্তমান স্থিতি")}</span><StatusPill status={report.status} language={locale}/></div><div className="public-detail-fact"><span>{tr(locale, "Category", "শ্ৰেণী")}</span><strong>{categoryLabel(report.category, locale)}</strong></div><div className="public-detail-fact"><span>{tr(locale, "Location", "স্থান")}</span><strong><MapPin size={13}/>{report.building}{report.area ? ` · ${report.area}` : ""}</strong></div><div className="public-detail-fact"><span>{tr(locale, "Reported", "জনোৱা হৈছে")}</span><strong><CalendarDays size={13}/>{formatDate(report.createdAt, false, locale)}</strong></div><div className="public-detail-privacy"><ShieldCheck size={16}/><p>{tr(locale, "Personal details, original submissions, and staff notes are kept private. This page only shows the public summary and status updates.", "ব্যক্তিগত তথ্য, মূল দাখিল আৰু কৰ্মচাৰীৰ টোকা গোপন ৰখা হয়। এই পৃষ্ঠাত কেৱল ৰাজহুৱা সাৰাংশ আৰু স্থিতিৰ আপডেট দেখুওৱা হয়।")}</p></div></aside></div>
      </>}
    </div><footer className="public-issues-footer"><span>{tr(locale, "Campus problems understood. Actions made visible.", "কেম্পাছৰ সমস্যা বুজি, কাম-কাজ দৃশ্যমান কৰা হৈছে।")}</span><Link href="/issues">{tr(locale, "Public issue board", "ৰাজহুৱা সমস্যা ফলক")}</Link></footer>
  </main>;
}
