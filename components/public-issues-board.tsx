"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownWideNarrow, ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, CircleCheck, Clock3, Layers3, MapPin, Search, ShieldCheck, TriangleAlert, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageToggle } from "@/components/language-toggle";
import { useWorkspace } from "@/components/workspace-provider";
import { PriorityPill, StatusPill } from "@/components/report-ui";
import { categoryLabel, priorityLabel, statusLabel, tr } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { categories, type Category, type Priority, type ReportStatus } from "@/lib/types";
import campusBanner from "@/src/assets/campus-banner.png";

type PublicReport = { ticketNumber: string; titleEn: string; titleAs: string; summaryEn: string; summaryAs: string; category: Category; priority: Priority; building: string; area: string; status: ReportStatus; createdAt: string };
type FeedResponse = { reports: PublicReport[]; count: number; page: number; pageSize: number; stats: { total: number; underReview: number; resolved: number; urgent: number }; error?: string };

export function PublicIssuesBoard() {
  const { locale } = useWorkspace();
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [count, setCount] = useState(0);
  const [stats, setStats] = useState({ total: 0, underReview: 0, resolved: 0, urgent: 0 });
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [sort, setSort] = useState("latest");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const params = useMemo(() => {
    const value = new URLSearchParams();
    if (query.trim()) value.set("q", query.trim());
    if (status) value.set("status", status);
    if (category) value.set("category", category);
    if (priority) value.set("priority", priority);
    value.set("sort", sort);
    return value;
  }, [query, status, category, priority, sort]);

  const loadPage = useCallback(async (targetPage: number, append: boolean, signal?: AbortSignal) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError("");
    try {
      const url = new URLSearchParams(params);
      url.set("page", String(targetPage));
      const response = await fetch(`/api/public/issues?${url.toString()}`, { cache: "no-store", signal });
      const body = await response.json() as FeedResponse;
      if (!response.ok) throw new Error(body.error || "Unable to load public reports.");
      setReports((current) => append ? [...current, ...body.reports] : body.reports);
      setCount(body.count);
      setStats(body.stats);
      setPage(targetPage);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "Unable to load public reports.");
      if (!append) setReports([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [params]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadPage(1, false, controller.signal), query ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [loadPage, query]);

  const clearFilters = () => { setQuery(""); setStatus(""); setCategory(""); setPriority(""); setSort("latest"); };
  const selectChip = (value: "all" | "review" | "resolved" | "urgent") => {
    setStatus(value === "review" ? "Under review" : value === "resolved" ? "Resolved" : "");
    setPriority(value === "urgent" ? "Urgent" : "");
  };
  const activeChip = priority === "Urgent" ? "urgent" : status === "Under review" ? "review" : status === "Resolved" ? "resolved" : "all";
  const anyFilter = Boolean(query || status || category || priority);

  return <main className="public-issues-page">
    <header className="public-issues-nav"><Brand href="/"/><div className="public-issues-nav-actions"><LanguageToggle/><Link className="button button-outline button-small" href="/"><ArrowLeft size={14}/>{tr(locale, "Home", "মূল পৃষ্ঠা")}</Link></div></header>
    <section className="public-board-hero">
      <Image src={campusBanner} alt="A leafy campus courtyard and university buildings" fill priority className="public-board-hero-image" sizes="100vw"/>
      <div className="public-board-hero-wash"/>
      <div className="public-board-hero-content">
        <div className="section-kicker">{tr(locale, "Campus community · public issue board", "কেম্পাছ সম্প্ৰদায় · ৰাজহুৱা সমস্যা ফলক")}</div>
        <h1>{tr(locale, "Campus issues,", "কেম্পাছৰ সমস্যা,")}<br/><em>{tr(locale, "made visible.", "দৃশ্যমান হওক।")}</em></h1>
        <p>{tr(locale, "Follow reported concerns and see how campus teams are responding. Personal details and original submissions remain private.", "জনোৱা সমস্যাসমূহ অনুসৰণ কৰক আৰু কেম্পাছৰ দলে কেনেদৰে কাম কৰিছে চাওক। ব্যক্তিগত তথ্য আৰু মূল দাখিল গোপন থাকে।")}</p>
        <div className="public-issues-trust"><ShieldCheck size={15}/>{tr(locale, "Reports marked private and reports flagged as sensitive are not shown.", "ব্যক্তিগত বা সংবেদনশীল বুলি চিহ্নিত প্ৰতিবেদন ইয়াত দেখুওৱা নহয়।")}<Link href="/how-it-works">{tr(locale, "How it works", "ই কেনেকৈ কাম কৰে")} <ArrowRight size={12}/></Link></div>
      </div>
    </section>

    <section className="public-glance" aria-label={tr(locale, "Campus at a glance", "কেম্পাছৰ এক নজৰ")}>
      <div className="public-glance-heading"><div><div className="section-kicker">{tr(locale, "Campus at a glance", "কেম্পাছৰ এক নজৰ")}</div></div><span>{tr(locale, "Live public updates", "লাইভ ৰাজহুৱা আপডেট")}</span></div>
      <div className="public-glance-grid">
        <Metric icon={<Layers3/>} value={stats.total} label={tr(locale, "Public reports", "ৰাজহুৱা প্ৰতিবেদন")} tone="green"/>
        <Metric icon={<Clock3/>} value={stats.underReview} label={tr(locale, "Under review", "পৰ্যালোচনাধীন")} tone="gold"/>
        <Metric icon={<CircleCheck/>} value={stats.resolved} label={statusLabel("Resolved", locale)} tone="green"/>
        <Metric icon={<TriangleAlert/>} value={stats.urgent} label={tr(locale, "Urgent priority", "জৰুৰী অগ্ৰাধিকাৰ")} tone="red"/>
      </div>
    </section>

    <section className="public-issues-list">
      <div className="public-issues-list-head"><div><div className="section-kicker">{tr(locale, "Open community updates", "সম্প্ৰদায়ৰ শেহতীয়া আপডেট")}</div><h2>{tr(locale, "Reported around campus", "কেম্পাছত জনোৱা সমস্যা")}</h2><p>{tr(locale, "Browse public concerns and follow their progress.", "ৰাজহুৱা সমস্যাসমূহ ব্ৰাউজ কৰক আৰু অগ্ৰগতি অনুসৰণ কৰক।")}</p></div><span>{tr(locale, `Showing ${count} reports`, `${count}টা প্ৰতিবেদন`)}</span></div>
      <div className="public-filter-row">
        <label className="public-search"><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr(locale, "Search issues, locations or report IDs…", "সমস্যা, স্থান বা প্ৰতিবেদন ID বিচাৰক…")}/>{query && <button aria-label={tr(locale, "Clear search", "বিচাৰ মচি পেলাওক")} onClick={() => setQuery("")}><X size={14}/></button>}</label>
        <label className="public-select"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{tr(locale, "All status", "সকলো স্থিতি")}</option>{(["Under review", "Investigating", "In progress", "Awaiting admin review", "Resolved"] as ReportStatus[]).map((item) => <option key={item} value={item}>{statusLabel(item, locale)}</option>)}</select><ChevronDown size={14}/></label>
        <label className="public-select"><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">{tr(locale, "All categories", "সকলো শ্ৰেণী")}</option>{categories.map((item) => <option key={item} value={item}>{categoryLabel(item, locale)}</option>)}</select><ChevronDown size={14}/></label>
        <label className="public-select"><select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">{tr(locale, "All priority", "সকলো অগ্ৰাধিকাৰ")}</option>{(["Urgent", "High", "Medium", "Low"] as const).map((item) => <option key={item} value={item}>{priorityLabel(item, locale)}</option>)}</select><ChevronDown size={14}/></label>
        <label className="public-select public-sort"><ArrowDownWideNarrow size={15}/><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="latest">{tr(locale, "Latest", "শেহতীয়া")}</option><option value="oldest">{tr(locale, "Oldest", "পুৰণি")}</option><option value="priority">{tr(locale, "Priority", "অগ্ৰাধিকাৰ")}</option></select><ChevronDown size={14}/></label>
      </div>
      <div className="public-filter-chips" role="group" aria-label={tr(locale, "Quick filters", "দ্ৰুত ফিল্টাৰ")}>
        <Chip active={activeChip === "all"} onClick={() => selectChip("all")}>{tr(locale, "All", "সকলো")} <b>{stats.total}</b></Chip>
        <Chip active={activeChip === "review"} onClick={() => selectChip("review")}>{tr(locale, "Under review", "পৰ্যালোচনাধীন")} <b>{stats.underReview}</b></Chip>
        <Chip active={activeChip === "resolved"} onClick={() => selectChip("resolved")}>{statusLabel("Resolved", locale)} <b>{stats.resolved}</b></Chip>
        <Chip active={activeChip === "urgent"} onClick={() => selectChip("urgent")}>{tr(locale, "Urgent", "জৰুৰী")} <b>{stats.urgent}</b></Chip>
        {anyFilter && <button className="public-clear-filters" onClick={clearFilters}>{tr(locale, "Clear filters", "ফিল্টাৰ আঁতৰাওক")} <X size={13}/></button>}
      </div>
      {loading ? <div className="public-issues-empty"><span className="public-loading-mark"/><h3>{tr(locale, "Loading public updates", "ৰাজহুৱা আপডেট লোড হৈছে")}</h3><p>{tr(locale, "Fetching the latest reports shared with the campus community.", "কেম্পাছ সম্প্ৰদায়ৰ সৈতে ভাগ কৰা শেহতীয়া প্ৰতিবেদন অনা হৈছে।")}</p></div>
        : error ? <div className="public-issues-empty"><h3>{tr(locale, "Updates are unavailable", "আপডেট উপলব্ধ নহয়")}</h3><p>{error}</p><button className="button button-outline button-small" onClick={() => void loadPage(1, false)}>{tr(locale, "Try again", "পুনৰ চেষ্টা কৰক")}</button></div>
          : reports.length ? <><div className="public-issues-grid">{reports.map((report) => <PublicIssueCard key={report.ticketNumber} report={report} locale={locale}/>)}</div>{reports.length < count && <div className="public-issues-more"><button className="button button-outline" onClick={() => void loadPage(page + 1, true)} disabled={loadingMore}>{loadingMore ? tr(locale, "Loading…", "লোড হৈছে…") : <>{tr(locale, "Load more reports", "অধিক প্ৰতিবেদন চাওক")} <ArrowRight size={14}/></>}</button></div>}</>
            : <div className="public-issues-empty"><Search size={23}/><h3>{tr(locale, "No reports match", "মিল থকা প্ৰতিবেদন নাই")}</h3><p>{tr(locale, "Try adjusting your search or filters. Private, sensitive, and synthetic reports are never shown here.", "বিচৰা শব্দ বা ফিল্টাৰ সলনি কৰি চাওক। ব্যক্তিগত, সংবেদনশীল আৰু কল্পিত প্ৰতিবেদন ইয়াত কেতিয়াও দেখুওৱা নহয়।")}</p>{anyFilter && <button className="button button-outline button-small" onClick={clearFilters}>{tr(locale, "Clear filters", "ফিল্টাৰ আঁতৰাওক")}</button>}</div>}
    </section>
    <footer className="public-issues-footer"><span>{tr(locale, "Campus problems understood. Actions made visible.", "কেম্পাছৰ সমস্যা বুজি, কাম-কাজ দৃশ্যমান কৰা হৈছে।")}</span><div><Link href="/how-it-works">{tr(locale, "About this board", "এই ফলকৰ বিষয়ে")}</Link><Link href="/login">{tr(locale, "Campus staff sign in", "কৰ্মচাৰীৰ প্ৰৱেশ")}</Link></div></footer>
  </main>;
}

function Metric({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone: string }) { return <article className={`public-metric public-metric-${tone}`}><span className="public-metric-icon">{icon}</span><div><strong>{String(value).padStart(2, "0")}</strong><span>{label}</span></div></article>; }
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button className={`public-filter-chip${active ? " is-active" : ""}`} onClick={onClick}>{children}</button>; }
function PublicIssueCard({ report, locale }: { report: PublicReport; locale: "en" | "as" }) {
  const statusStep = report.status === "Resolved" ? 3 : ["Investigating", "In progress", "Awaiting admin review"].includes(report.status) ? 2 : 1;
  const title = locale === "as" ? report.titleAs : report.titleEn;
  const summary = locale === "as" ? report.summaryAs : report.summaryEn;
  return <Link className="public-issue-card" href={`/issues/${encodeURIComponent(report.ticketNumber)}`}>
    <div className="public-issue-card-top"><span className="public-ticket">{report.ticketNumber}</span><StatusPill status={report.status} language={locale}/></div>
    <h3>{title}</h3><p>{summary}</p>
    <div className="public-issue-tags"><PriorityPill priority={report.priority} language={locale}/><span>{categoryLabel(report.category, locale)}</span></div>
    <span className="public-issue-location"><MapPin size={13}/>{report.building}{report.area ? ` · ${report.area}` : ""}</span>
    <div className="public-card-progress" aria-label={tr(locale, `${statusStep} of 3 steps complete`, `মুঠ ৩টা ধাপৰ ভিতৰত ${statusStep}টা সম্পূৰ্ণ`)}><div className="public-card-progress-steps">{[1, 2, 3].map((step) => <span className={step < statusStep ? "is-done" : step === statusStep ? "is-current" : ""} key={step}>{step < statusStep ? <Check size={10}/> : step}</span>)}</div><small>{report.status === "Resolved" ? statusLabel(report.status, locale) : report.status === "Under review" ? tr(locale, "Received · awaiting review", "গ্ৰহণ কৰা হৈছে · পৰ্যালোচনাৰ অপেক্ষাত") : tr(locale, "Being worked on", "কাম চলি আছে")}</small></div>
    <span className="public-issue-date"><CalendarDays size={13}/>{formatDate(report.createdAt, false, locale)}<ArrowRight size={14} className="public-card-arrow"/></span>
  </Link>;
}
