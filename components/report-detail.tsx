'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  useParams,
  useRouter
} from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Languages,
  MapPin,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UsersRound
} from 'lucide-react';
import {
  toast
} from 'sonner';
import {
  useWorkspace
} from '@/components/workspace-provider';
import {
  PriorityPill,
  StatusPill
} from '@/components/report-ui';
import {
  categories,
  priorities,
  statuses,
  type Report,
  type SimilarReport
} from '@/lib/types';
import {
  categoryLabel,
  languageLabel,
  priorityLabel,
  reportTitle,
  statusLabel,
  tr
} from '@/lib/i18n';
import {
  formatDate,
  timeAgo
} from '@/lib/format';

export function ReportDetail({
  reportId: requestedId
}: {
  reportId ? : string
} = {}) {
  const params = useParams < {
    id ? : string
  } > ();
  const router = useRouter();
  const id = requestedId ?? params.id ?? '';
  const {
    reports,
    clusters,
    user,
    isDemo,
    locale,
    refresh,
    updateReport,
    deleteReport,
    closeReport,
    createCluster,
    updateCluster
  } = useWorkspace();
  const report = reports.find((item) => item.id === id);
  const [matches, setMatches] = useState < SimilarReport[] > ([]);
  const [matchesForId, setMatchesForId] = useState < string | null > (null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [separating, setSeparating] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const isAdmin = user.role === 'admin';
  const canStaffWork = user.role === 'staff' && Boolean(user.department && report?.assignedDepartment === user.department);
  const backHref = isAdmin ? '/admin/issues' : user.role === 'staff' ? '/staff' : '/app/reports';
  const loadingMatches = Boolean(report && !isDemo && isAdmin && matchesForId !== report.id);

  useEffect(() => {
    if (!isDemo && !report && !notFound) void refresh().then(() => {
      if (!reports.some((item) => item.id === id)) setNotFound(true);
    });
  }, [isDemo, report, refresh, reports, id, notFound]);
  useEffect(() => {
    if (!report || isDemo || user.role !== 'admin') return;
    let current = true;
    fetch(`/api/reports/${report.id}/similar`, {
      cache: 'no-store'
    }).then(async (response) => {
      if (response.ok) {
        const body = await response.json() as {
          matches: SimilarReport[]
        };
        if (current) setMatches(body.matches);
      }
    }).catch(() => undefined).finally(() => {
      if (current) setMatchesForId(report.id);
    });
    return () => {
      current = false;
    };
  }, [report, isDemo, user.role]);

  const demoRelated = useMemo(() => report?.clusterId ? reports.filter((item) => item.clusterId === report.clusterId && item.id !== report.id).map((item) => ({
    report: item,
    score: 1,
    explanation: 'Synthetic demonstration data: these original reports have been grouped for the product walkthrough.',
    explanationAs: 'ডেম’ৰ কল্পিত তথ্য: এই মূল প্ৰতিবেদনসমূহ প্ৰদৰ্শনীৰ বাবে একেলগ কৰা হৈছে।'
  })) : [], [report, reports]);
  const related = isDemo ? demoRelated : matches;
  if (!report) return <div className = 'panel empty-state' > < Clock3 size = {21} /> <h3 > {  notFound ? tr(locale, 'Report not found', 'প্ৰতিবেদন পোৱা নগ’ল') : tr(locale, 'Loading report', 'প্ৰতিবেদন লোড হৈছে')  } </h3><p>{notFound ? tr(locale,'This report is unavailable or you do not have access to it.','এই প্ৰতিবেদন উপলব্ধ নহয় বা চোৱাৰ অনুমতি নাই।') : tr(locale,'This report may belong to your connected account.','এই প্ৰতিবেদন আপোনাৰ সংযুক্ত একাউণ্টৰ হ’ব পাৰে।')}</p > < Link href = {backHref} className = 'button button-outline button-small' > { tr(locale, 'Back to reports', 'প্ৰতিবেদনলৈ উভতি যাওক') } </Link></div > ;
  const cluster = clusters.find((item) => item.id === report.clusterId);
  const events = [...report.events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const sourceLang = report.originalLanguage === 'Assamese' ? 'as' : report.originalLanguage === 'Romanised Assamese' ? 'as-Latn' : report.originalLanguage === 'Mixed' ? 'mul' : 'en';

  async function confirmRelated(item: SimilarReport) {
    setSaving(true);
    try {
      await createCluster(`${report!.building} · ${reportTitle(report!, locale)}`, [report!.id, item.report.id]);
      toast.success(tr(locale, 'Reports grouped in an issue cluster.', 'প্ৰতিবেদনসমূহ এটা সমস্যা ক্লাষ্টাৰত একেলগ কৰা হ’ল।'));
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : tr(locale, 'Could not create the issue cluster.', 'সমস্যাৰ ক্লাষ্টাৰ সৃষ্টি কৰিব পৰা নগ’ল।'));
    } finally {
      setSaving(false);
    }
  }
  async function separate(reportId: string) {
    const clusterId = report?.clusterId;
    if (!clusterId) return;
    setSeparating(true);
    try {
      await updateCluster(clusterId, {}, reportId);
      toast.success(tr(locale, 'Report separated from the cluster.', 'প্ৰতিবেদনটো ক্লাষ্টাৰৰ পৰা পৃথক কৰা হ’ল।'));
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : tr(locale, 'Could not separate report.', 'প্ৰতিবেদনটো পৃথক কৰিব পৰা নগ’ল।'));
    } finally {
      setSeparating(false);
    }
  }
  async function handleDelete() {
    if (!window.confirm(tr(locale, 'Are you sure you want to permanently delete this report?', 'আপুনি সঁচাকৈ এই প্ৰতিবেদনটো স্থায়ীভাৱে মচি পেলাব বিচাৰে নেকি?'))) return;
    setDeleting(true);
    try {
      await deleteReport(report.id);
      toast.success(tr(locale, 'The report has been deleted.', 'প্ৰতিবেদনটো মচি পেলোৱা হ’ল।'));
      setTimeout(() => {
        closeReport();
        router.push(backHref);
      }, 1000); // Delay for 1 second to allow toast to be seen
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : tr(locale, 'The report could not be deleted.', 'প্ৰতিবেদনটো মচিব পৰা নগ’ল।'));
      setDeleting(false); // Reset deleting state on error
    }
  }

  return < > < div className = 'page-heading report-hero' > < div className = 'report-hero-copy' > < Link href = {backHref} className = 'panel-link' style = { {
    marginBottom: 13
  } } > < ArrowLeft size = {12} /> {isAdmin?tr(locale,'Issue desk','অভিযোগৰ ডেস্ক'):user.role === 'staff' ? tr(locale,'Staff queue','কৰ্মচাৰীৰ শাৰী') : tr(locale,'Your reports','আপোনাৰ প্ৰতিবেদন')}</Link > < div className = 'section-kicker report-kicker' > { report.ticketNumber } &middot; { tr(locale, 'submitted', 'দাখিল কৰা হৈছে') } { formatDate(report.createdAt, false, locale) } { report.isSynthetic && < span className = 'language-tag' style = { {
    marginLeft: 7
  } } > { tr(locale, 'Synthetic demo', 'কল্পিত ডেম’') } </span>}</div > < h1 > { reportTitle(report, locale) } </h1><div className='report-location-row'><span><MapPin size={12} style={{verticalAlign:'-2px'}}/> {report.building}{report.area?` &middot; ${report.area}`:''}</span > < span > < Languages size = {12} style = { {
    verticalAlign: '-2px'
  } } /> {languageLabel(report.originalLanguage,locale)}</span > </div></div > < div className = 'heading-actions report-hero-actions' > < StatusPill status = {report.status} language = {locale} /> < PriorityPill priority = { report.confirmedPriority || report.suggestedPriority } language = {locale} /> </div></div > {(report.analysisStatus === 'pending' || report.analysisStatus === 'failed') && < div className = 'demo-banner' > < Sparkles size = {14} /> < span > < strong > { report.analysisStatus === 'failed' ? tr(locale, 'Analysis needs another try.', 'বিশ্লেষণ পুনৰ চেষ্টা কৰিব লাগিব।') : tr(locale, 'Analysis pending.', 'বিশ্লেষণৰ অপেক্ষাত।') } </strong> {report.analysisError || tr(locale,'The report is saved while analysis is finishing. Please refresh in a moment.','বিশ্লেষণ চলি থকা সময়তো মূল প্ৰতিবেদন সংৰক্ষিত থাকে। অলপ পিছত পুনৰ চেষ্টা কৰক।')}</span > { isAdmin && !isDemo && < button className = 'button button-outline button-small' onClick = { async () => {
    const response = await fetch(`/api/admin/reports/${report.id}/analyze`, {
      method: 'POST'
    });
    if (response.ok) {
      await refresh();
      toast.success(tr(locale, 'Analysis completed.', 'বিশ্লেষণ সম্পূৰ্ণ হ’ল।'));
    } else {
      const body = await response.json();
      toast.error(body.error || tr(locale, 'Retry failed.', 'পুনৰ চেষ্টা বিফল হ’ল।'));
    }
  } } > { tr(locale, 'Retry analysis', 'বিশ্লেষণ পুনৰ চেষ্টা কৰক') } </button>}</div>}
    <div className='detail-layout'><div className='detail-main'>
      <section className='detail-panel detail-quote-panel'><div className='detail-panel-header'><div><div className='section-kicker' style={{marginBottom:7}}>{tr(locale,'Original wording · source language preserved','মূল ভাষাৰ কথা · উৎস ভাষা অক্ষুণ্ণ')}</div > < h2 className = { sourceLang.startsWith('as') ? 'assamese' : '' } lang = {sourceLang} > { languageLabel(report.originalLanguage, locale) } </h2></div > < div className = 'detail-indicator' > < Sparkles size = {14} /> {tr(locale,'Evidence','প্ৰমাণ')}</div > </div><blockquote className={`original-quote ${sourceLang.startsWith('as')?'assamese':''}`} lang={sourceLang}>{report.originalText}</blockquote > { report.imageUrl && < div style = { {
    marginTop: 18
  } } > < Image src = { report.imageUrl } alt = { report.imageCaption || tr(locale, 'Photograph attached to the campus report', 'কেম্পাছৰ প্ৰতিবেদনৰ সৈতে সংলগ্ন আলোকচিত্ৰ') } width = {880} height = {560} unoptimized style = { {
    maxWidth: '100%',
    maxHeight: 350,
    objectFit: 'cover',
    width: 'auto',
    height: 'auto'
  } } /> {report.imageCaption && <p className='muted-copy'>{tr(locale,'Visible evidence:','দৃশ্যমান প্ৰমাণ:')} {report.imageCaption}</p > } </div>}</section >
      <section className='detail-panel detail-summary-panel'><div className='detail-panel-header'><div><div className='section-kicker' style={{marginBottom:7}}>{tr(locale,'Bilingual understanding','দ্বিভাষিক বোধ')}</div > < h2 > { tr(locale, 'One clear picture, in both languages.', 'দুয়োটা ভাষাতে একে স্পষ্ট ছবি।') } </h2></div > < div className = 'detail-indicator detail-indicator-success' title = { report.analysisStatus === 'complete' ? tr(locale, 'AI analysis complete', 'এআই বিশ্লেষণ সম্পূৰ্ণ') : tr(locale, 'Analysis pending', 'বিশ্লেষণৰ অপেক্ষাত') } > < Sparkles size = {14} /> {report.analysisStatus === 'complete' ? tr(locale,'AI ready','এআই প্রস্তুত') : tr(locale,'Reviewing','পৰ্যালোচনা')}</div > </div><div className='bilingual-grid'><div className='summary-card'><small>English &middot; concise summary</small><p>{report.summaryEn}</p > </div><div className='summary-card as-summary assamese' lang='as'><small>অসমীয়া &middot; চমু সাৰাংশ</small><p>{report.summaryAs}</p > </div></div><div className='report-meta' style={{marginTop:15}}><span>{tr(locale,'Suggested category:','পৰামৰ্শ দিয়া শ্ৰেণী:')} <strong > { categoryLabel(report.category, locale) } </strong></span > < span > { tr(locale, 'Suggested priority:', 'পৰামৰ্শ দিয়া অগ্ৰাধিকাৰ:') } < PriorityPill priority = {report.suggestedPriority} language = {locale} /> </span><span>{tr(locale,'Suggested department:','পৰামৰ্श দিয়া বিভাগ:')} <strong > { report.department } </strong></span > </div><p className='muted-copy'>{report.priorityExplanation}</p > { report.analysisError && < p className = 'error-text' role = 'status' > { tr(locale, 'Analysis note:', 'বিশ্লেষণৰ টোকা:') } { report.analysisError } </p>}
      </section >
      <section className='detail-panel'><div className='section-kicker' style={{marginBottom:7}}>{tr(locale,'Related campus reports','সম্পৰ্কিত কেম্পাছৰ প্ৰতিবেদন')}</div > < h2 > { tr(locale, 'Could these concerns be connected?', 'এই সমস্যাবোৰৰ মাজত সম্পৰ্ক থাকিব পাৰেনে?') } </h2><p className='muted-copy' style={{marginTop:-7,marginBottom:14}}>{tr(locale,'CivicSense compares original-language text and campus location. A person reviews every suggestion before reports are grouped.','CivicSense-এ মূল ভাষাৰ বিৱৰণ আৰু কেম্পাছৰ স্থান তুলনা কৰে। প্ৰতিবেদন একেলগ কৰাৰ আগতে এজন ব্যক্তিয়ে প্ৰতিটো পৰামৰ্श পৰ্যালোচনা কৰে।')}</p > { cluster && < div className = 'related-box' style = { {
    marginTop: 0,
    marginBottom: 13
  } } > < div className = 'related-box-head' > < UsersRound size = {13} /> {tr(locale,'Confirmed issue cluster','নিশ্চিত সমস্যা ক্লাষ্টাৰ')}</div > < p > { cluster.title } </p><div className='field-hint'>{cluster.reportIds.length} {tr(locale,'reports','টা প্ৰতিবেদন')} &middot; {cluster.location} &middot; {statusLabel(cluster.status,locale)}</div > < div className = 'cluster-languages' > { [...new Set(reports.filter((item) => cluster.reportIds.includes(item.id)).map((item) => item.originalLanguage))].map((language) => < span key = {language} className = 'language-tag' > { languageLabel(language, locale) } </span>)}</div > </div>}{loadingMatches && <div className='field-hint'>{tr(locale,'Checking for related reports…','সম্পৰ্কিত প্ৰতিবেদন বিচৰা হৈছে…')}</div > } {  related.length ? related.map((match) => < div className = 'related-match' key = { match.report.id } style = { {
    marginTop: 9
  } } > < div className = 'match-head' > < div > < div className = 'section-kicker' > { tr(locale, 'Possible match', 'সম্ভাৱ্য মিল') } &middot; {match.report.ticketNumber} &middot; {languageLabel(match.report.originalLanguage,locale)}</div > < div className = 'match-report' style = { {
    marginTop: 8
  } } > < strong > { reportTitle(match.report, locale) } </strong><span>{match.report.building} &middot; {match.report.area}</span > </div></div > {!isDemo && <div className='match-score'>{Math.round(match.score*100)}%</div>}</div > < p className = 'match-reason' > { locale === 'as' ? match.explanationAs : match.explanation } </p>{isAdmin && !cluster && <button className='button button-outline button-small' disabled={saving} onClick={()=>void confirmRelated(match)}><Check size={13}/> {tr(locale,'Confirm connection','সম্পৰ্ক নিশ্চিত কৰক')}</button > } { isAdmin && cluster && < button className = 'button button-outline button-small' disabled = {separating} onClick = { () => void separate(match.report.id) } > { tr(locale, 'Separate this report', 'এই প্ৰতিবেদন পৃথক কৰক') } </button>}</div > ) : !loadingMatches ? < div className = 'empty-state' style = { {
    padding: 21
  } } > < Languages size = {18} /> < p > { tr(locale, 'No related reports have been suggested yet. As new reports arrive, this view will look across languages and locations.', 'এতিয়াও সম্পৰ্কিত প্ৰতিবেদন পৰামৰ্শ দিয়া হোৱা নাই। নতুন প্ৰতিবেদন আহিলে ভাষা আৰু স্থানৰ ভিত্তিত মিল বিচৰা হ’ব।') } </p></div > : null}
      </section >
      <section className='detail-panel'><div className='section-kicker' style={{marginBottom:13}}>{tr(locale,'Status history','স্থিতিৰ ইতিহাস')}</div > < h2 > { tr(locale, 'What has happened so far', 'এতিয়ালৈকে কি কি হ’ল') } </h2>{events.length ? <div className='timeline'>{events.map((event)=><div className='timeline-entry' key={event.id}><div className='timeline-node'><i/></div > < div className = 'timeline-content' > < strong > { event.newStatus ? `${tr(locale,'Status:','স্থিতি:')} ${statusLabel(event.newStatus,locale)}` : tr(locale, 'Update added', 'আপডেট যোগ কৰা হৈছে') } </strong><p>{event.message}</p > < time > { event.actor } &middot; {formatDate(event.createdAt,true,locale)}</time > </div></div > )}</div> : <div className='empty-state' style={{padding:16}}><Clock3 size={17}/><p>{tr(locale,'No status changes yet. Your report has been received and is waiting for review.','এতিয়াও স্থিতি সলনি হোৱা নাই। আপোনাৰ প্ৰতিবেদন পোৱা গৈছে আৰু পৰ্যালোচনাৰ অপেক্ষাত আছে।')}</p > </div>}
      </section >
    </div><aside className='detail-side'><section className='detail-panel'><div className='section-kicker' style={{marginBottom:12}}>{tr(locale,'Report at a glance','প্ৰতিবেদনৰ চমু তথ্য')}</div > < div className = 'detail-stat' > < span > { tr(locale, 'Current status', 'বৰ্তমান স্থিতি') } </span><strong><StatusPill status={report.status} language={locale}/></strong > </div><div className='detail-stat'><span>{tr(locale,'Priority','অগ্ৰাধিকাৰ')}</span > < strong > < PriorityPill priority = { report.confirmedPriority || report.suggestedPriority } language = {locale} /> </strong></div > < div className = 'detail-stat' > < span > { tr(locale, 'Category', 'শ্ৰেণী') } </span><strong>{categoryLabel(report.category,locale)}</strong > </div><div className='detail-stat'><span>{tr(locale,'Campus location','কেম্পাছৰ স্থান')}</span > < strong > { report.building } { report.area ? ` &middot; ${report.area}` : '' } </strong></div > < div className = 'detail-stat' > < span > { tr(locale, 'Assigned department', 'দায়িত্বত থকা বিভাগ') } </span><strong>{report.assignedDepartment || tr(locale,'Not assigned','দায়িত্ব দিয়া হোৱা নাই')}</strong > </div><div className='detail-stat'><span>{tr(locale,'Assigned team','দায়িত্বত থকা দল')}</span > < strong > { report.assignedTo || tr(locale, 'Not assigned', 'দায়িত্ব দিয়া হোৱা নাই') } </strong></div > < div className = 'detail-stat' > < span > { tr(locale, 'Last updated', 'শেহতীয়াকৈ আপডেট') } </span><strong>{timeAgo(report.updatedAt,locale)}</strong > </div><div className='detail-stat'><span>{tr(locale,'Source language','উৎস ভাষা')}</span > < strong > { languageLabel(report.originalLanguage, locale) } </strong></div > </section>
      {isAdmin ? <ReportAdminControls key={`${report.id}:${report.status}`} report={report} saving={saving} onSaving={setSaving} updateReport={updateReport} language={locale}/> : canStaffWork ? <ReportStaffControls key={`${report.id}:${report.status}`} report={report} saving={saving} onSaving={setSaving} updateReport={updateReport} language={locale}/> : <div className='privacy-note'><ShieldCheck size={15}/><span>{tr(locale,'Only you and authorised campus staff can see this report. Status changes are shared with you.','আপুনি আৰু অনুমোদিত কেম্পাছ কৰ্মচাৰীয়েহে এই প্ৰতিবেদন চাব পাৰে। স্থিতিৰ সলনি আপোনাক জনোৱা হয়।')}</span > </div>}
      {(isAdmin || user.id === report.reporterId) && <section className='detail-panel'><div className='section-kicker' style={{marginBottom:8}}>{tr(locale,'Manage report','প্ৰতিবেদন পৰিচালনা')}</div > < button className = 'button button-outline button-danger' style = { {
    width: '100%'
  } } onClick = { () => void handleDelete() } disabled = {deleting} > < Trash2 size = {13} /> {deleting?tr(locale,'Deleting…','মচি পেলোৱা হৈছে…'):tr(locale,'Delete this report','এই প্ৰতিবেদন মচি পেলাওক')}</button > < p className = 'field-hint' style = { {
    marginTop: 8
  } } > { tr(locale, 'This action is permanent and cannot be undone.', 'এইটো এটা স্থায়ী পদক্ষেপ আৰু ইয়াক বাতিল কৰিব নোৱাৰি।') } </p></section > } <section className = 'detail-panel' > < div className = 'section-kicker' style = { {
    marginBottom: 8
  } } > { tr(locale, 'How CivicSense helps', 'CivicSense-এ কেনেকৈ সহায় কৰে') } </div><p className='muted-copy' style={{marginTop:0}}>{tr(locale,'Original text and photos stay with the report. AI suggestions support triage; campus staff make the final classification, priority, and grouping decisions.','মূল লেখা আৰু আলোকচিত্ৰ প্ৰতিবেদনৰ সৈতে থাকে। এআই-ৰ পৰামৰ্শই বাছনি কৰাত সহায় কৰে; চূড়ান্ত শ্ৰেণী, অগ্ৰাধিকাৰ আৰু গোটৰ সিদ্ধান্ত কেম্পাছৰ কৰ্মচাৰীয়ে লয়।')}</p > < Link href = { isAdmin ? '/admin/clusters' : '/app' } className = 'panel-link' style = { {
    marginTop: 13
  } } > { isAdmin ? tr(locale, 'Manage issue clusters', 'সমস্যাৰ ক্লাষ্টাৰ পৰিচালনা') : tr(locale, 'Back to overview', 'পৰিচিতিলৈ উভতি যাওক') } < ArrowRight size = {12} /> </Link></section >
    </aside></div >
  </> ;
}

function ReportAdminControls({
  report,
  saving,
  onSaving,
  updateReport,
  language
}: {
  report: Report;
  saving: boolean;
  onSaving: (value: boolean) => void;
  updateReport: (id: string, update: Partial < Pick < Report, 'status' | 'category' | 'confirmedPriority' | 'assignedTo' | 'assignedDepartment' >> , message ? : string) => Promise < void > ;
  language: 'en' | 'as';
}) {
  const [status, setStatus] = useState < Report['status'] > (report.status);
  const [priority, setPriority] = useState < Report['suggestedPriority'] > (report.confirmedPriority || report.suggestedPriority);
  const [category, setCategory] = useState < Report['category'] > (report.category);
  const [assignedDepartment, setAssignedDepartment] = useState(report.assignedDepartment || report.department || '');
  const [assignedTo, setAssignedTo] = useState(report.assignedTo || '');
  const [note, setNote] = useState('');
  const departments = ['Facilities & Maintenance', 'Electrical Services', 'IT Services', 'Library Services', 'Sanitation & Waste', 'Student Housing', 'Health Services'];
  async function save() {
    onSaving(true);
    try {
      await updateReport(report.id, {
        status,
        category,
        confirmedPriority: priority,
        assignedDepartment: assignedDepartment.trim() || null,
        assignedTo: assignedTo.trim() || null
      }, note.trim() || undefined);
      setNote('');
      toast.success(tr(language, 'Report updates saved.', 'প্ৰতিবেদনৰ আপডেট সংৰক্ষণ কৰা হ’ল।'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr(language, 'Could not save report updates.', 'প্ৰতিবেদনৰ আপডেট সংৰক্ষণ কৰিব পৰা নগ’ল।'));
    } finally {
      onSaving(false);
    }
  }
  async function review(nextStatus: Report['status']) {
    onSaving(true);
    try {
      await updateReport(report.id, {
        status: nextStatus
      }, note.trim());
      setNote('');
      toast.success(nextStatus === 'Resolved' ? tr(language, 'Resolution approved.', 'সমাধান অনুমোদন কৰা হ’ল।') : tr(language, 'Report returned to staff.', 'প্ৰতিবেদন কৰ্মচাৰীলৈ ঘূৰাই পঠিওৱa হ’ল।'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr(language, 'The review decision could not be saved.', 'পৰ্যালোচনাৰ সিদ্ধান্ত সংৰক্ষণ কৰিব পৰা নগ’ল।'));
    } finally {
      onSaving(false);
    }
  }
  return <section className = 'detail-panel' > < div className = 'section-kicker' style = { {
    marginBottom: 8
  } } > { tr(language, 'Administrator actions', 'প্ৰশাসকৰ পদক্ষেপ') } </div><h2>{report.status === 'Awaiting admin review' ? tr(language,'Review staff completion','কৰ্মচাৰীৰ সম্পূৰ্ণ কাম পৰ্যালোচনা কৰক') : tr(language,'Update this report','এই প্ৰতিবেদন আপডেট কৰক')}</h2 > { report.status === 'Awaiting admin review' && < p className = 'review-callout' > { tr(language, 'Staff have submitted this issue for your decision. Add a review note, then approve the resolution or return the work to the department.', 'কৰ্মচাৰীয়ে এই সমস্যাটো আপোনাৰ সিদ্ধান্তৰ বাবে পঠিয়াইছে। পৰ্যালোচনাৰ টোকা দি সমাধান অনুমোদন কৰক অথবা বিভাগলৈ উভতাই দিয়ক।') } </p>}<div className='admin-controls'><label>{tr(language,'Status','স্থিতি')}<select value={status} onChange={(event)=>setStatus(event.target.value as Report['status'])}>{statuses.map((item)=><option key={item} value={item}>{statusLabel(item,language)}</option>)}</select></label > < label > { tr(language, 'Confirmed priority', 'নিশ্চিত অগ্ৰাধিকাৰ') } < select value = {priority} onChange = { (event) => setPriority(event.target.value as Report['suggestedPriority']) } > { priorities.map((item) => < option key = {item} value = {item} > { priorityLabel(item, language) } </option>)}</select > </label><label>{tr(language,'Category','শ্ৰেণী')}<select value={category} onChange={(event)=>setCategory(event.target.value as Report['category'])}>{categories.map((item)=><option key={item} value={item}>{categoryLabel(item,language)}</option>)}</select></label > < label > { tr(language, 'Assigned department', 'দায়িত্বত থকা বিভাগ') } < select value = {assignedDepartment} onChange = { (event) => setAssignedDepartment(event.target.value) } > < option value = '' > { tr(language, 'Choose a department', 'বিভাগ বাছক') } </option>{![...departments].includes(assignedDepartment)&&assignedDepartment&&<option value={assignedDepartment}>{assignedDepartment}</option > } { departments.map((item) => < option key = {item} value = {item} > {item} </option>)}</select > </label><label>{tr(language,'Assigned team / person','দায়িত্বত থকা দল / ব্যক্তি')}<input value={assignedTo} maxLength={120} onChange={(event)=>setAssignedTo(event.target.value)} placeholder={tr(language,'e.g. Facilities team','যেনে: সা-সুবিধা দল')}/></label > < label > { tr(language, 'Update for the reporter', 'প্ৰতিবেদন দিওঁতাৰ baবে আপডেট') } < textarea value = {note} maxLength = {1000} onChange = { (event) => setNote(event.target.value) } placeholder = { tr(language, 'Add a clear, useful status update…', 'স্থিতিৰ এটা স্পষ্ট আৰু সহায়ক আপডেট দিয়ক…') } /> </label><div className='admin-review-actions'><button className='button button-primary button-small' disabled={saving || report.status === 'Awaiting admin review' && (!note.trim() || status === 'In progress')} onClick={()=>void save()}><Send size={14}/>{saving?tr(language,'Saving…','সংৰক্ষণ কৰা হৈছে…'):report.status === 'Awaiting admin review'?tr(language,'Save update','আপডেট সংৰক্ষণ কৰক'):tr(language,'Save update','আপডেট সংৰক্ষণ কৰক')}</button > { report.status === 'Awaiting admin review' && < > < button className = 'button button-terracotta button-small' disabled = { saving || !note.trim() } onClick = { () => void review('Resolved') } > < Check size = {14} /> {tr(language,'Approve & resolve','অনুমোদন কৰি সমাধান কৰক')}</button > < button className = 'button button-outline button-small' disabled = { saving || !note.trim() } onClick = { () => void review('In progress') } > < ArrowLeft size = {14} /> {tr(language,'Return to staff','কৰ্মচাৰীলৈ উভতাই দিয়ক')}</button > </>}</div > </div></section > ;
}

function ReportStaffControls({
  report,
  saving,
  onSaving,
  updateReport,
  language
}: {
  report: Report;
  saving: boolean;
  onSaving: (value: boolean) => void;
  updateReport: (id: string, update: Partial < Pick < Report, 'status' | 'category' | 'confirmedPriority' | 'assignedTo' | 'assignedDepartment' >> , message ? : string) => Promise < void > ;
  language: 'en' | 'as';
}) {
  const [status, setStatus] = useState < 'Investigating' | 'In progress' > (report.status === 'In progress' ? 'In progress' : 'Investigating');
  const [note, setNote] = useState('');
  async function save(nextStatus: 'Investigating' | 'In progress' | 'Awaiting admin review') {
    onSaving(true);
    try {
      await updateReport(report.id, {
        status: nextStatus
      }, note.trim());
      setNote('');
      toast.success(nextStatus === 'Awaiting admin review' ? tr(language, 'Sent to the administrator for review.', 'প্ৰশাসকৰ পৰ্যালোচনালৈ পঠিওৱা হ’ল।') : tr(language, 'Work update saved.', 'কামৰ আপডেট সংৰক্ষণ কৰা হ’ল।'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr(language, 'Work update could not be saved.', 'কামৰ আপডেট সংৰক্ষণ কৰিব পৰা নগ’ল।'));
    } finally {
      onSaving(false);
    }
  }
  if (report.status === 'Awaiting admin review') return <section className = 'detail-panel staff-review-wait' > < div className = 'section-kicker' > { tr(language, 'Administrator review', 'প্ৰশাসকৰ পৰ্যালোচনা') } </div><h2>{tr(language, 'Your update is with the administrator', 'আপোনাৰ আপডেট প্ৰশাসকৰ ওচৰত আছে')}</h2 > < p > { tr(language, 'You’ll see the decision and any follow-up note in the report history.', 'সিদ্ধান্ত আৰু পৰৱৰ্তী টোকা প্ৰতিবেদনৰ ইতিহাসত দেখা পাব।') } </p></section > ;
  const allowedStates: Array < 'Investigating' | 'In progress' > = report.status === 'Under review' ? ['Investigating'] : ['Investigating', 'In progress'];
  return <section className = 'detail-panel staff-update-panel' > < div className = 'section-kicker' style = { {
    marginBottom: 8
  } } > { tr(language, 'Department actions', 'বিভাগৰ পদক্ষেপ') } </div><h2>{tr(language,'Record work on this issue','এই সমস্যাৰ কামৰ বিৱৰণ দিয়ক')}</h2 > < p className = 'muted-copy' > { tr(language, 'Update the work state and leave a note for the reporter. Staff cannot close an issue; completed work goes to an administrator for approval.', 'কামৰ স্থিতি আপডেট কৰি প্ৰতিবেদন দিওঁতাক এটা টোকা দিয়ক। কৰ্মচাৰীয়ে সমস্যা বন্ধ কৰিব নোৱাৰে; সম্পূৰ্ণ কাম অনুমোদনৰ বাবে প্ৰশাসকলৈ যায়।') } </p><div className='admin-controls'><label>{tr(language,'Work state','কামৰ স্থিতি')}<select value={status} onChange={(event)=>setStatus(event.target.value as 'Investigating' | 'In progress')}>{allowedStates.map((item)=><option key={item} value={item}>{statusLabel(item,language)}</option>)}</select></label > < label > { tr(language, 'Work note', 'কামৰ টোকা') } < textarea value = {note} maxLength = {1000} onChange = { (event) => setNote(event.target.value) } placeholder = { tr(language, 'Describe what you checked or completed…', 'আপুনি কি পৰীক্ষা বা সম্পূৰ্ণ কৰিলে লিখক…') } /> </label><div className='staff-action-row'><button className='button button-primary' disabled={saving || note.trim().length < 3} onClick={()=>void save(status)}><Send size={14}/>{saving?tr(language,'Saving…','সংৰক্ষণ হৈছে…'):tr(language,'Save work update','কামৰ আপডেট সংৰক্ষণ')}</button > < button className = 'button button-terracotta' disabled = { saving || report.status !== 'In progress' || note.trim().length < 3 } onClick = { () => void save('Awaiting admin review') } > < ShieldCheck size = {15} /> {tr(language,'Submit for admin review','প্ৰশাসকৰ পৰ্যালোচনালৈ পঠিয়াওক')}</button > </div>{report.status !== 'In progress' && <span className='field-hint'>{tr(language,'Move the issue to In progress before sending it for review.','পৰ্যালোচনালৈ পঠিওৱাৰ আগতে সমস্যাটো কাম চলি থকা অৱস্থালৈ নিন।')}</span > }</div></section > ;
}
