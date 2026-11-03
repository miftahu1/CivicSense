"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, Check, Clock3, GitBranch, Layers3, Languages, MapPin, Search, Sparkles, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace-provider";
import { PriorityPill, StatusPill } from "@/components/report-ui";
import { statuses, type Report, type SimilarReport } from "@/lib/types";
import { categoryLabel, languageLabel, reportTitle, statusLabel, tr } from "@/lib/i18n";
import { normalizeDepartment } from "@/lib/departments";
import { campusDepartments } from "@/lib/departments";

export function ClusterManager() {
  const { clusters, reports, user, locale, createCluster, updateCluster } = useWorkspace();
  const [reviewReports, setReviewReports] = useState<Report[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewPage, setReviewPage] = useState(0);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewLoadingMore, setReviewLoadingMore] = useState(false);
  const [reviewLoadError, setReviewLoadError] = useState("");
  const [activeReportId, setActiveReportId] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [matches, setMatches] = useState<SimilarReport[]>([]);
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([]);
  const [clusterTitle, setClusterTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [matchError, setMatchError] = useState("");
  const [busy, setBusy] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [staffDepartments, setStaffDepartments] = useState<string[]>([]);
  const [departmentsLoaded, setDepartmentsLoaded] = useState(false);
  const canAdmin = user.role === "admin";
  const activeReport = reviewReports.find((report) => report.id === activeReportId);
  const unclustered = reviewReports;
  const filteredReports = useMemo(() => unclustered.filter((report) =>
    `${report.ticketNumber} ${reportTitle(report, locale)} ${report.building} ${report.area} ${report.originalText}`.toLocaleLowerCase().includes(reportSearch.toLocaleLowerCase())), [unclustered, reportSearch, locale]);

  const loadReviewReports = useCallback(async (page: number, append = false) => {
    if (append) setReviewLoadingMore(true);
    else setReviewLoading(true);
    setReviewLoadError("");
    try {
      const response = await fetch(`/api/admin/clusters/review?page=${page}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Review reports could not be loaded.");
      const rows = body.reports as Report[];
      setReviewReports((current) => append ? [...current, ...rows] : rows);
      setReviewCount(Number(body.count) || 0);
      setReviewPage(Number(body.page) || page);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Review reports could not be loaded.";
      setReviewLoadError(message);
      throw error;
    } finally {
      setReviewLoading(false);
      setReviewLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!canAdmin) return;
    const timer = window.setTimeout(() => {
      void loadReviewReports(1).catch((error) => toast.error(error instanceof Error ? error.message : "Review reports could not be loaded."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canAdmin, loadReviewReports]);

  useEffect(() => {
    if (!canAdmin) return;
    let current = true;
    fetch("/api/admin/team", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Staff departments could not be loaded.");
        const departments = [...new Set<string>((body.users || [])
          .filter((member: { role?: string; department?: string | null }) => member.role === "staff" && Boolean(member.department?.trim()))
          .map((member: { department: string }) => normalizeDepartment(member.department))
          .filter((department: string | null): department is string => Boolean(department)))].sort((a, b) => a.localeCompare(b));
        if (current) setStaffDepartments(departments);
      })
      .catch((error) => { if (current) toast.error(error instanceof Error ? error.message : "Staff departments could not be loaded."); })
      .finally(() => { if (current) setDepartmentsLoaded(true); });
    return () => { current = false; };
  }, [canAdmin]);

  useEffect(() => {
    if (!activeReportId || !activeReport) return;
    let current = true;
    fetch(`/api/reports/${activeReportId}/similar`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Possible matches could not be loaded.");
        if (current) setMatches((body.matches as SimilarReport[]).filter((item) => !item.report.clusterId));
      })
      .catch((error) => { if (current) setMatchError(error instanceof Error ? error.message : "Possible matches could not be loaded."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [activeReportId, activeReport, locale]);

  async function createReviewedCluster() {
    if (!activeReport || selectedMatchIds.length === 0) return;
    const title = clusterTitle.trim();
    if (title.length < 3) { toast.error(tr(locale, "Give the shared issue a short title.", "সমস্যাটোৰ এটা চমু শিৰোনাম দিয়ক।")); return; }
    const ids = [activeReport.id, ...selectedMatchIds];
    setBusy("create");
    try {
      await createCluster(title, ids);
      toast.success(tr(locale, `Issue cluster created with ${ids.length} reports.`, `${ids.length}টা প্ৰতিবেদনেৰে সমস্যা ক্লাষ্টাৰ সৃষ্টি কৰা হ’ল।`));
      await loadReviewReports(1).catch(() => undefined);
      setActiveReportId("");
      setReportSearch("");
      setMatches([]);
      setSelectedMatchIds([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr(locale, "Could not create the issue cluster.", "সমস্যা ক্লাষ্টাৰ সৃষ্টি কৰিব পৰা নগ’ল।"));
    } finally { setBusy(""); }
  }

  function toggleMatch(id: string) {
    setSelectedMatchIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function update(id: string, patch: Parameters<typeof updateCluster>[1], message?: string): Promise<boolean> {
    setBusy(id);
    try {
      await updateCluster(id, patch, undefined, message);
      toast.success(tr(locale, "Cluster update saved and applied to its reports.", "ক্লাষ্টাৰৰ আপডেট সংৰক্ষণ কৰি ইয়াৰ প্ৰতিবেদনসমূহত প্ৰয়োগ কৰা হ’ল।"));
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr(locale, "Could not update the cluster.", "ক্লাষ্টাৰ আপডেট কৰিব পৰা নগ’ল।"));
      return false;
    } finally { setBusy(""); }
  }

  async function separate(clusterId: string, reportId: string) {
    setBusy(reportId);
    try {
      await updateCluster(clusterId, {}, reportId);
      await loadReviewReports(1).catch(() => undefined);
      toast.success(tr(locale, "Report separated. Its original submission is unchanged.", "প্ৰতিবেদনটো পৃথক কৰা হ’ল। মূল দাখিল সলনি হোৱা নাই।"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr(locale, "Could not separate this report.", "এই প্ৰতিবেদন পৃথক কৰিব পৰা নগ’ল।"));
    } finally { setBusy(""); }
  }

  async function resolveCluster(clusterId: string) {
    const note = resolutionNotes[clusterId]?.trim();
    if (!note || note.length < 8) { toast.error(tr(locale, "Add a useful resolution note before closing this cluster.", "ক্লাষ্টাৰ বন্ধ কৰাৰ আগতে সহায়ক সমাধানৰ টোকা দিয়ক।")); return; }
    if (await update(clusterId, { status: "Resolved" }, note)) setResolutionNotes((previous) => ({ ...previous, [clusterId]: "" }));
  }

  if (!canAdmin) return <div className="panel empty-state"><UsersRound size={21}/><h3>{tr(locale, "Administrator access required", "প্ৰশাসকৰ অনুমতি প্ৰয়োজন")}</h3><p>{tr(locale, "Sign in with an authorised campus operations account to manage confirmed issue clusters.", "নিশ্চিত সমস্যা ক্লাষ্টাৰ পৰিচালনা কৰিবলৈ অনুমোদিত কেম্পাছ পৰিচালনা একাউণ্টেৰে ছাইন ইন কৰক।")}</p></div>;

  const activeStatuses = statuses.filter((status) => status !== "Resolved");
  const openClusters = clusters.filter((cluster) => cluster.status !== "Resolved").length;
  const reportCount = clusters.reduce((total, cluster) => total + cluster.reportIds.length, 0);

  return <div className="cluster-workspace">
    <div className="page-heading"><div><div className="section-kicker">{tr(locale, "Administrator workspace · Cross-language intelligence", "প্ৰশাসকৰ ৱৰ্কস্পেচ · ভাষা-পাৰ কৰা বুদ্ধিমত্তা")}</div><h1>{tr(locale, "Issue clusters", "সমস্যাৰ ক্লাষ্টাৰ")}</h1><p>{tr(locale, "Find reports about one real campus issue, review the evidence, then coordinate one response across everyone affected.", "একেটা কেম্পাছ সমস্যাৰ বিষয়ে থকা প্ৰতিবেদন বিচাৰি, প্ৰমাণ পৰ্যালোচনা কৰি, প্ৰভাৱিত সকলোৰে বাবে একেলগে সঁহাৰি দিয়ক।")}</p></div><div className="heading-actions"><span className="status-pill status-progress"><GitBranch size={13}/>{clusters.length} {tr(locale, "confirmed clusters", "টা নিশ্চিত ক্লাষ্টাৰ")}</span></div></div>

    <section className="cluster-overview" aria-label={tr(locale, "Cluster overview", "ক্লাষ্টাৰৰ পৰিচিতি")}>
      <article><Layers3 size={19}/><div><span>{tr(locale, "Confirmed groups", "নিশ্চিত গোট")}</span><strong>{clusters.length}</strong></div></article>
      <article><Activity size={19}/><div><span>{tr(locale, "Active issues", "সক্ৰিয় সমস্যা")}</span><strong>{openClusters}</strong></div></article>
      <article><UsersRound size={19}/><div><span>{tr(locale, "Reports coordinated", "সমন্বয় কৰা প্ৰতিবেদন")}</span><strong>{reportCount}</strong></div></article>
      <article><Search size={19}/><div><span>{tr(locale, "Ready for review", "পৰ্যালোচনাৰ বাবে সাজু")}</span><strong>{reviewCount}</strong></div></article>
    </section>

    <section className="cluster-review-panel panel">
      <div className="cluster-review-heading"><div><div className="section-kicker">{tr(locale, "Review before grouping", "গোট কৰাৰ আগতে পৰ্যালোচনা কৰক")}</div><h2>{tr(locale, "Do these reports describe the same underlying issue?", "এই প্ৰতিবেদনসমূহ একেটা মূল সমস্যাৰ বিষয়ে নেকি?")}</h2><p>{tr(locale, "Semantic similarity finds candidates. Compare location, category, timing and the original wording before grouping recurring reports into one coordinated issue.", "অৰ্থৰ মিলৰ ভিত্তিত সম্ভাৱ্য প্ৰতিবেদন দেখুওৱা হয়। পুনৰাবৃত্ত সমস্যাক একেলগে গোট কৰাৰ আগতে স্থান, শ্ৰেণী, সময় আৰু মূল বৰ্ণনা তুলনা কৰক।")}</p></div><span className="cluster-human-review"><Check size={13}/>{tr(locale, "Admin confirms every group", "প্ৰতিটো গোট প্ৰশাসকে নিশ্চিত কৰে")}</span></div>

      <div className="cluster-review-grid">
        <div className="cluster-source-column">
          <label className="cluster-search-label" htmlFor="cluster-report-search">{tr(locale, "Find an ungrouped report", "গোট নকৰা প্ৰতিবেদন বিচাৰক")}</label>
          <div className="search-field"><Search size={15}/><input id="cluster-report-search" value={reportSearch} onChange={(event) => setReportSearch(event.target.value)} placeholder={tr(locale, "Search ticket, issue or building", "টিকিট, সমস্যা বা ভৱন বিচাৰক")}/></div>
          <label className="cluster-search-label" htmlFor="cluster-source-report">{tr(locale, "Choose the report to compare", "তুলনাৰ বাবে প্ৰতিবেদন বাছক")}</label>
          <select id="cluster-source-report" value={activeReportId} disabled={reviewLoading && !reviewReports.length} onChange={(event) => {
            const nextId = event.target.value;
            const nextReport = reviewReports.find((report) => report.id === nextId);
            setActiveReportId(nextId);
            setMatches([]);
            setSelectedMatchIds([]);
            setMatchError("");
            setLoading(Boolean(nextId));
            if (nextReport) setClusterTitle(`${nextReport.building} · ${reportTitle(nextReport, locale)}`.slice(0, 160));
          }}>
            <option value="">{tr(locale, reviewLoading && !reviewReports.length ? "Loading reports…" : "Select a report", reviewLoading && !reviewReports.length ? "প্ৰতিবেদন লোড হৈছে…" : "প্ৰতিবেদন বাছক")}</option>
            {filteredReports.map((report) => <option key={report.id} value={report.id}>{report.ticketNumber} · {reportTitle(report, locale)} · {report.building}</option>)}
          </select>
          <div className="cluster-source-count"><span>{tr(locale, `Showing ${reviewReports.length} of ${reviewCount} reviewable reports`, `${reviewCount}টা পৰ্যালোচনাযোগ্য প্ৰতিবেদনৰ ${reviewReports.length}টা দেখুওৱা হৈছে`)}</span><span>{reviewLoadError || tr(locale, "Resolved, unanalysed and already grouped reports are excluded.", "সমাধান কৰা, বিশ্লেষণ নোহোৱা আৰু আগতে গোট কৰা প্ৰতিবেদন বাদ দিয়া হৈছে।")}</span>{reviewReports.length < reviewCount && <button type="button" className="button button-outline button-small" disabled={reviewLoadingMore} onClick={() => void loadReviewReports(reviewPage + 1, true)}>{reviewLoadingMore ? tr(locale, "Loading…", "লোড হৈছে…") : tr(locale, "Load 100 older reports", "১০০টা পুৰণি প্ৰতিবেদন লোড কৰক")}</button>}</div>
          {activeReport && <div className="cluster-source-report"><div className="cluster-source-meta"><span>{activeReport.ticketNumber} · {languageLabel(activeReport.originalLanguage, locale)}</span><StatusPill status={activeReport.status} language={locale}/></div><h3>{reportTitle(activeReport, locale)}</h3><p className={activeReport.originalLanguage === "Assamese" ? "assamese" : ""} lang={activeReport.originalLanguage === "Assamese" ? "as" : activeReport.originalLanguage === "Romanised Assamese" ? "as-Latn" : "en"}>{activeReport.originalText}</p><div className="cluster-source-signals"><span><MapPin size={12}/>{activeReport.building}{activeReport.area ? ` · ${activeReport.area}` : ""}</span><span>{categoryLabel(activeReport.category, locale)}</span><PriorityPill priority={activeReport.confirmedPriority || activeReport.suggestedPriority} language={locale}/></div></div>}
        </div>

        <div className="cluster-candidate-column">
          {!activeReport ? <div className="cluster-candidate-empty"><Sparkles size={22}/><h3>{tr(locale, "Cross-language matching", "ভাষা-পাৰ কৰা মিল")}</h3><p>{tr(locale, "Select a report to compare it with other active reports. The original language is preserved while semantic meaning is compared.", "অন্য সক্ৰিয় প্ৰতিবেদনৰ সৈতে তুলনা কৰিবলৈ এটা প্ৰতিবেদন বাছক। মূল ভাষা অক্ষত ৰাখি অৰ্থৰ মিল পৰীক্ষা কৰা হয়।")}</p></div> : loading ? <div className="cluster-candidate-empty"><span className="diagnostics-spinner"/><p>{tr(locale, "Finding similar active reports…", "সদৃশ সক্ৰিয় প্ৰতিবেদন বিচৰা হৈছে…")}</p></div> : matchError ? <div className="cluster-match-error"><AlertTriangle size={17}/><span>{matchError}</span></div> : matches.length ? <>
            <div className="cluster-candidate-head"><div><div className="section-kicker">{tr(locale, "Ranked candidates", "সাদৃশ্য অনুসৰি প্ৰাৰ্থী")}</div><h3>{matches.length} {tr(locale, "possible connections", "টা সম্ভাৱ্য সম্পৰ্ক")}</h3></div><span>{tr(locale, "Select one or more", "এটা বা অধিক বাছক")}</span></div>
            <p className="cluster-score-note">{tr(locale, "Semantic score compares wording; it is not the probability that two reports are the same issue. Review the evidence before grouping.", "অৰ্থৰ স্ক’ৰে বৰ্ণনাৰ মিল তুলনা কৰে; ই দুটা প্ৰতিবেদন একে সমস্যাৰ হোৱাৰ সম্ভাৱনা নহয়। গোট কৰাৰ আগতে প্ৰমাণ চাওক।")}</p>
            <div className="cluster-candidate-list">{matches.map((match) => {
              const checked = selectedMatchIds.includes(match.report.id);
              const evidence = match.evidence;
              return <label className={`cluster-candidate ${checked ? "selected" : ""}`} key={match.report.id}>
                <input type="checkbox" checked={checked} onChange={() => toggleMatch(match.report.id)} aria-label={`${tr(locale, "Select report", "প্ৰতিবেদন বাছক")} ${match.report.ticketNumber}`}/>
                <div className="cluster-candidate-body"><div className="cluster-candidate-top"><div><span className="section-kicker">{tr(locale, "Candidate", "প্ৰাৰ্থী")} · {match.report.ticketNumber}</span><h4>{reportTitle(match.report, locale)}</h4></div><div className="semantic-score"><strong>{match.score.toFixed(2)}</strong><span>{tr(locale, "semantic score", "অৰ্থৰ স্ক’ৰ")}</span></div></div>
                  <p className={match.report.originalLanguage === "Assamese" ? "assamese" : ""} lang={match.report.originalLanguage === "Assamese" ? "as" : match.report.originalLanguage === "Romanised Assamese" ? "as-Latn" : "en"}>{match.report.originalText}</p>
                  <div className="cluster-candidate-meta"><span><MapPin size={12}/>{match.report.building}{match.report.area ? ` · ${match.report.area}` : ""}</span><span>{categoryLabel(match.report.category, locale)}</span></div>
                  <div className="cluster-evidence-list">
                    {evidence && <>
                      <span className={evidence.sameBuilding ? "evidence-positive" : "evidence-caution"}>{evidence.sameBuilding ? <Check size={11}/> : <X size={11} />}{tr(locale, evidence.sameBuilding ? "Same building" : "Different building", evidence.sameBuilding ? "একে ভৱন" : "বেলেগ ভৱন")}</span>
                      <span className={evidence.sameArea ? "evidence-positive" : "evidence-caution"}>{evidence.sameArea ? <Check size={11}/> : <MapPin size={11} />}{tr(locale, evidence.sameArea ? "Same area" : "Area differs / unknown", evidence.sameArea ? "একে ঠাই" : "ঠাই বেলেগ / অজ্ঞাত")}</span>
                      <span className={evidence.sameCategory ? "evidence-positive" : "evidence-caution"}>{evidence.sameCategory ? <Check size={11}/> : <Layers3 size={11} />}{tr(locale, evidence.sameCategory ? "Same category" : "Different category", evidence.sameCategory ? "একে শ্ৰেণী" : "বেলেগ শ্ৰেণী")}</span>
                      {evidence.differentLanguage && <span className="evidence-neutral"><Languages size={11}/>{tr(locale, "Cross-language match", "ভাষা-পাৰ কৰা মিল")}</span>}
                      <span className={evidence.daysApart <= 7 ? "evidence-positive" : "evidence-caution"}><Clock3 size={11}/>{tr(locale, `${evidence.daysApart} days apart`, `${evidence.daysApart} দিনৰ ব্যৱধান`)}</span>
                    </>}
                  </div><p className="cluster-candidate-reason">{locale === "as" ? match.explanationAs : match.explanation}</p>
                </div>
              </label>;
            })}</div>
            <div className="cluster-create-row"><label>{tr(locale, "Shared issue title", "একেটা সমস্যাৰ শিৰোনাম")}<input value={clusterTitle} maxLength={160} onChange={(event) => setClusterTitle(event.target.value)} placeholder={tr(locale, "Name the underlying campus issue", "মূল কেম্পাছ সমস্যাটোৰ নাম দিয়ক")}/></label><button className="button button-primary" disabled={!selectedMatchIds.length || busy === "create"} onClick={() => void createReviewedCluster()}><GitBranch size={15}/>{busy === "create" ? tr(locale, "Creating…", "সৃষ্টি কৰা হৈছে…") : tr(locale, `Group ${selectedMatchIds.length + 1} reports`, `${selectedMatchIds.length + 1}টা প্ৰতিবেদন গোট কৰক`)}</button></div>
          </> : <div className="cluster-candidate-empty"><Search size={20}/><h3>{tr(locale, "No strong matches found", "শক্তিশালী মিল পোৱা নগ’ল")}</h3><p>{tr(locale, "No active report cleared the current semantic threshold. You can leave these reports separate and review again after new submissions.", "কোনো সক্ৰিয় প্ৰতিবেদনে বৰ্তমানৰ অৰ্থ-মিলৰ সীমা অতিক্ৰম কৰা নাই। প্ৰতিবেদনসমূহ পৃথক ৰাখি নতুন দাখিলৰ পিছত পুনৰ পৰ্যালোচনা কৰিব পাৰে।")}</p></div>}
        </div>
      </div>
    </section>

    <div className="cluster-list-heading"><div><div className="section-kicker">{tr(locale, "Admin-confirmed groups", "প্ৰশাসকে নিশ্চিত কৰা গোট")}</div><h2>{tr(locale, "Coordinated campus issues", "সমন্বিত কেম্পাছ সমস্যা")}</h2></div><span>{clusters.length} {tr(locale, "groups ·", "টা গোট ·")} {reportCount} {tr(locale, "reports", "টা প্ৰতিবেদন")}</span></div>
    {clusters.length ? <div className="cluster-grid">{clusters.map((cluster) => {
      const members = cluster.reports || reports.filter((report) => cluster.reportIds.includes(report.id));
      const memberLanguages = [...new Set(members.map((report) => report.originalLanguage))];
      const memberBuildings = [...new Set(members.map((report) => report.building))];
      const departments = [...new Set(members.map((report) => report.assignedDepartment).filter((department): department is string => Boolean(department)))];
      const selectedDepartment = departments.length === 1 ? departments[0] : "";
      const isBusy = busy === cluster.id || busy.startsWith(`${cluster.id}:`);
      return <article className="cluster-card" key={cluster.id}>
        <header className="cluster-card-head"><div><div className="cluster-card-kicker"><span>{categoryLabel(cluster.category, locale)}</span><span>{cluster.reportIds.length} {tr(locale, "reports", "টা প্ৰতিবেদন")}</span></div><h2>{cluster.title}</h2><p><MapPin size={12}/>{cluster.location} · {memberBuildings.length} {tr(locale, "locations", "টা স্থান")}</p></div><StatusPill status={cluster.status} language={locale}/></header>
        <div className="cluster-card-facts"><span><Languages size={13}/>{memberLanguages.map((language) => languageLabel(language, locale)).join(" · ")}</span>{cluster.assignedDepartment && <span><UsersRound size={13}/>{cluster.assignedDepartment}</span>}{departments.length > 1 && <span className="cluster-warning"><AlertTriangle size={13}/>{tr(locale, "Member departments differ", "সদস্যৰ বিভাগ বেলেগ")}</span>}</div>
        <div className="cluster-member-list">{members.map((report) => <div className="cluster-member" key={report.id}><div className="cluster-member-body"><div className="cluster-member-heading"><Link href={`/app/reports/${report.id}`}>{report.ticketNumber} · {reportTitle(report, locale)}</Link><StatusPill status={report.status} language={locale}/></div><p className={report.originalLanguage === "Assamese" ? "assamese" : ""} lang={report.originalLanguage === "Assamese" ? "as" : report.originalLanguage === "Romanised Assamese" ? "as-Latn" : "en"}>{report.originalText}</p><span className="cluster-member-location"><MapPin size={11}/>{report.building}{report.area ? ` · ${report.area}` : ""} · {languageLabel(report.originalLanguage, locale)}</span></div><button type="button" className="button button-outline button-small cluster-separate" disabled={isBusy} onClick={() => void separate(cluster.id, report.id)}>{tr(locale, "Separate", "পৃথক কৰক")}</button></div>)}</div>
        <div className="cluster-admin-controls"><label>{tr(locale, "Issue status", "সমস্যাৰ স্থিতি")}<select disabled={isBusy} value={cluster.status} onChange={(event) => void update(cluster.id, { status: event.target.value as Report["status"] })}>{activeStatuses.map((status) => <option key={status} value={status}>{statusLabel(status, locale)}</option>)}{cluster.status === "Resolved" && <option value="Resolved">{statusLabel("Resolved", locale)}</option>}</select></label>
          <label>{tr(locale, "Assigned department", "দায়িত্বত থকা বিভাগ")}<select disabled={isBusy || !departmentsLoaded} value={selectedDepartment} onChange={(event) => void update(cluster.id, { assignedDepartment: event.target.value || null })}><option value="">{tr(locale, departments.length ? "Choose a department" : "No department assigned", departments.length ? "বিভাগ বাছক" : "বিভাগ দিয়া হোৱা নাই")}</option>{campusDepartments.map((department) => <option key={department} value={department}>{department}{staffDepartments.includes(department) ? "" : tr(locale, " · no staff assigned", " · কৰ্মচাৰী নাই")}</option>)}</select>{selectedDepartment && !staffDepartments.includes(selectedDepartment) && <span className="field-hint">{tr(locale, "No staff account is assigned to this department yet. Add one in Team access to activate its queue.", "এই বিভাগত এতিয়াও কোনো কৰ্মচাৰী নাই। ইয়াৰ শাৰী সক্ৰিয় কৰিবলৈ Team access-ত কৰ্মচাৰী যোগ কৰক।")}</span>}</label>
          <label>{tr(locale, "Assigned team / person", "দায়িত্বত থকা দল / ব্যক্তি")}<input key={`${cluster.id}:${cluster.assignedTo || ""}`} defaultValue={cluster.assignedTo || ""} maxLength={120} disabled={isBusy} placeholder={tr(locale, "e.g. Facilities team", "যেনে: সা-সুবিধা দল")} onBlur={(event) => { const value = event.target.value.trim() || null; if (value !== cluster.assignedTo) void update(cluster.id, { assignedTo: value }); }}/></label>
        </div>
        {cluster.status !== "Resolved" ? <div className="cluster-resolution"><label htmlFor={`resolution-${cluster.id}`}>{tr(locale, "Close this issue for every reporter", "সকলো প্ৰতিবেদন দিওঁতাৰ বাবে সমস্যা সমাধান কৰক")}</label><textarea id={`resolution-${cluster.id}`} maxLength={1000} value={resolutionNotes[cluster.id] || ""} onChange={(event) => setResolutionNotes((previous) => ({ ...previous, [cluster.id]: event.target.value }))} placeholder={tr(locale, "Describe the repair or action completed. This note is added to each report.", "সম্পূৰ্ণ কৰা মেৰামতি বা পদক্ষেপ বৰ্ণনা কৰক। এই টোকা প্ৰতিটো প্ৰতিবেদনত যোগ হ’ব।")}/><button className="button button-primary button-small" disabled={isBusy || (resolutionNotes[cluster.id]?.trim().length || 0) < 8} onClick={() => void resolveCluster(cluster.id)}>{tr(locale, "Resolve cluster and notify reporters", "ক্লাষ্টাৰ সমাধান কৰি প্ৰতিবেদন দিওঁতাক জনাওক")}<ArrowRight size={13}/></button></div> : <div className="cluster-resolved-note"><Check size={14}/>{tr(locale, "Resolved. The outcome is recorded on all member reports.", "সমাধান কৰা হ’ল। ফলাফল সকলো প্ৰতিবেদনত সংৰক্ষিত হৈছে।")}</div>}
      </article>;
    })}</div> : <div className="panel empty-state cluster-empty"><Layers3 size={23}/><h3>{tr(locale, "No issue clusters yet", "এতিয়াও সমস্যা ক্লাষ্টাৰ নাই")}</h3><p>{tr(locale, "Review a report above. CivicSense surfaces cross-language candidates, and your confirmation starts a coordinated response while preserving every original report.", "ওপৰৰ প্ৰতিবেদন পৰ্যালোচনা কৰক। CivicSense-এ বিভিন্ন ভাষাৰ সম্ভাৱ্য মিল দেখুৱায়; আপোনাৰ নিশ্চিতকৰণে সমন্বিত সঁহাৰি আৰম্ভ কৰে আৰু প্ৰতিটো মূল প্ৰতিবেদন অক্ষত ৰাখে।")}</p><Link className="button button-outline button-small" href="/admin/issues">{tr(locale, "Open issue desk", "অভিযোগৰ ডেস্ক খোলক")}<ArrowRight size={13}/></Link></div>}
  </div>;
}
