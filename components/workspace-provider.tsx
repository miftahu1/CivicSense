"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AppUser, IssueCluster, Language, Report, ReportEvent, UserRole } from "@/lib/types";
import { demoClusters, demoReports } from "@/lib/demo-data";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { InterfaceLanguage } from "@/lib/i18n";

const DEMO_USER_ID: Record<UserRole, string> = { student: "demo-student", staff: "demo-staff", admin: "demo-admin" };
const DEMO_NAME: Record<UserRole, string> = { student: "Ananya Saikia", staff: "M. Hazarika", admin: "Operations desk" };
const defaultUser = (role: UserRole = "student", preferredLanguage: InterfaceLanguage = "en"): AppUser => ({ id: DEMO_USER_ID[role], name: DEMO_NAME[role], email: "", role, preferredLanguage });

function readSavedDemo() {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) as { role?: UserRole; locale?: InterfaceLanguage; reports?: Report[]; clusters?: IssueCluster[] } : null;
  } catch { return null; }
}

type SubmitReportInput = { originalText: string; language: Language; building: string; area: string; category?: Report["category"]; image?: File };
type WorkspaceContextValue = {
  user: AppUser;
  locale: InterfaceLanguage;
  setLocale: (locale: InterfaceLanguage) => Promise<void>;
  isDemo: boolean;
  reports: Report[];
  clusters: IssueCluster[];
  setDemoRole: (role: UserRole) => void;
  resetDemo: () => void;
  signOut: () => Promise<void>;
  submitReport: (input: SubmitReportInput) => Promise<Report>;
  updateReport: (id: string, update: Partial<Pick<Report, "status" | "category" | "confirmedPriority" | "assignedTo" | "assignedDepartment">>, message?: string) => Promise<void>;
  createCluster: (title: string, ids: string[]) => Promise<void>;
  updateCluster: (id: string, update: Partial<Pick<IssueCluster, "title" | "status" | "assignedTo">>, separateReportId?: string, resolutionMessage?: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const STORAGE_KEY = "civicsense-demo-workspace-v1";

function generateDemoReport(input: SubmitReportInput, user: AppUser): Report {
  const now = new Date().toISOString();
  const ticket = `CS-${String(Date.now()).slice(-5)}`;
  const title = input.originalText.replace(/\s+/g, " ").trim().slice(0, 72);
  return {
    id: `demo-${crypto.randomUUID()}`, ticketNumber: ticket, reporterId: user.id, reporterName: user.name,
    originalText: input.originalText, originalLanguage: input.language, titleEn: title, titleAs: "বিশ্লেষণৰ অপেক্ষাত",
    summaryEn: "Your original report is saved. Add Gemini credentials to generate the bilingual analysis.", summaryAs: "আপোনাৰ মূল প্ৰতিবেদন সংৰক্ষণ কৰা হৈছে। দ্বিভাষিক বিশ্লেষণৰ বাবে Gemini সংযোগ কৰক।",
    category: input.category || "Other", suggestedPriority: "Medium", confirmedPriority: null, priorityExplanation: "Awaiting configured Gemini analysis.",
    building: input.building, area: input.area, status: "Under review", clusterId: null, assignedTo: null, department: "Awaiting analysis", sensitive: false, analysisStatus: "pending", createdAt: now, updatedAt: now,
    imageUrl: input.image ? URL.createObjectURL(input.image) : undefined, imageCaption: undefined,
    events: [{ id: crypto.randomUUID(), actor: user.name, oldStatus: null, newStatus: "Under review", message: "Report submitted · waiting for analysis.", createdAt: now }], isSynthetic: true,
  };
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [savedDemo] = useState(readSavedDemo);
  const [locale, setLocaleState] = useState<InterfaceLanguage>(() => savedDemo?.locale === "as" ? "as" : "en");
  const [user, setUser] = useState<AppUser>(() => defaultUser(savedDemo?.role && savedDemo.role in DEMO_USER_ID ? savedDemo.role : "student", savedDemo?.locale === "as" ? "as" : "en"));
  const [reports, setReports] = useState<Report[]>(() => savedDemo?.reports?.length ? savedDemo.reports : demoReports);
  const [clusters, setClusters] = useState<IssueCluster[]>(() => savedDemo?.clusters || demoClusters);
  const [isDemo, setIsDemo] = useState(true);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (isDemo) return;
    const response = await fetch("/api/reports", { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json() as { reports: Report[] };
    setReports(body.reports);
    if (user.role === "admin") {
      const clusterResponse = await fetch("/api/admin/clusters", { cache: "no-store" });
      if (clusterResponse.ok) { const clusterBody = await clusterResponse.json() as { clusters: IssueCluster[] }; setClusters(clusterBody.clusters); }
    } else setClusters([]);
  }, [isDemo, user.role]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setReady(true); });
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return () => { active = false; };
    const applyUser = async (id: string) => {
      const { data } = await supabase.from("profiles").select("id, full_name, role, preferred_language").eq("id", id).single();
      if (!active || !data) return;
      const preferredLanguage = data.preferred_language === "as" ? "as" : "en";
      setUser({ id: data.id, name: data.full_name, email: "", role: data.role as UserRole, preferredLanguage });
      setLocaleState(preferredLanguage);
      setIsDemo(false);
    };
    void supabase.auth.getUser().then((result: {data:{user:{id:string}|null}}) => { if (result.data.user) void applyUser(result.data.user.id); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) setTimeout(() => void applyUser(session.user.id), 0);
      else { setIsDemo(true); setUser((previous) => defaultUser("student", previous.preferredLanguage)); }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!ready || !isDemo) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ role: user.role, locale, reports: reports.filter((report) => !report.imageUrl?.startsWith("blob:")), clusters }));
  }, [user.role, locale, reports, clusters, isDemo, ready]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => { if (isDemo) return; const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [isDemo, refresh]);
  useEffect(() => { if (isDemo) return; const timer = window.setInterval(() => void refresh(), 30_000); return () => window.clearInterval(timer); }, [isDemo, refresh]);

  const setDemoRole = useCallback((role: UserRole) => { setUser(defaultUser(role, locale)); setIsDemo(true); }, [locale]);
  const resetDemo = useCallback(() => { setReports(demoReports); setClusters(demoClusters); }, []);
  const setLocale = useCallback(async (nextLocale: InterfaceLanguage) => {
    setLocaleState(nextLocale);
    setUser((previous) => ({ ...previous, preferredLanguage: nextLocale }));
    if (isDemo) return;
    const supabase = createSupabaseBrowserClient();
    if (supabase) await supabase.from("profiles").update({ preferred_language: nextLocale }).eq("id", user.id);
  }, [isDemo, user.id]);
  const signOut = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    setIsDemo(true); setUser(defaultUser("student", locale));
  }, [locale]);

  const submitReport = useCallback(async (input: SubmitReportInput) => {
    if (isDemo) {
      const report = generateDemoReport(input, user);
      setReports((previous) => [report, ...previous]);
      return report;
    }
    const form = new FormData();
    form.set("originalText", input.originalText); form.set("language", input.language);
    form.set("building", input.building); form.set("area", input.area); if (input.category) form.set("category", input.category);
    if (input.image) form.set("image", input.image);
    const response = await fetch("/api/reports", { method: "POST", body: form });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Report could not be submitted.");
    await refresh();
    return body.report as Report;
  }, [isDemo, user, refresh]);

  const updateReport = useCallback(async (id: string, update: Partial<Pick<Report, "status" | "category" | "confirmedPriority" | "assignedTo" | "assignedDepartment">>, message?: string) => {
    if (isDemo) {
      const now = new Date().toISOString();
      setReports((previous) => previous.map((report) => {
        if (report.id !== id) return report;
        const oldStatus = report.status;
        const nextStatus = update.status ?? oldStatus;
        const event: ReportEvent | null = (message || nextStatus !== oldStatus) ? { id: crypto.randomUUID(), actor: user.name, oldStatus: nextStatus === oldStatus ? null : oldStatus, newStatus: nextStatus === oldStatus ? null : nextStatus, message: message || `Status updated to ${nextStatus}.`, createdAt: now } : null;
        return { ...report, ...update, updatedAt: now, events: event ? [event, ...report.events] : report.events };
      }));
      return;
    }
    const response = await fetch(`/api/admin/reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...update, message }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Update could not be saved.");
    await refresh();
  }, [isDemo, user.name, refresh]);

  const createCluster = useCallback(async (title: string, ids: string[]) => {
    if (ids.length < 2) throw new Error("Choose at least two reports to create an issue cluster.");
    if (isDemo) {
      const selected = reports.filter((report) => ids.includes(report.id));
      if (selected.length < 2) throw new Error("The selected reports are no longer available.");
      if (selected.some((report) => report.clusterId)) throw new Error("Separate reports from their current cluster before grouping them again.");
      const clusterId = `demo-cluster-${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const cluster: IssueCluster = { id: clusterId, title, category: selected[0].category, location: selected[0].building, status: "Under review", assignedTo: null, reportIds: ids, createdAt: now };
      const singletonIds = clusters.flatMap((oldCluster) => { const remaining = oldCluster.reportIds.filter((reportId) => !ids.includes(reportId)); return remaining.length === 1 ? remaining : []; });
      setClusters((previous) => [cluster, ...previous.map((item) => ({ ...item, reportIds: item.reportIds.filter((id) => !ids.includes(id)) })).filter((item) => item.reportIds.length >= 2)]);
      setReports((previous) => previous.map((report) => ids.includes(report.id) ? { ...report, clusterId, updatedAt: now, events: [{id:crypto.randomUUID(),actor:user.name,oldStatus:null,newStatus:null,message:`Grouped under “${title}” after administrator confirmation.`,createdAt:now},...report.events] } : singletonIds.includes(report.id) ? {...report,clusterId:null,updatedAt:now} : report));
      return;
    }
    const response = await fetch("/api/admin/clusters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, reportIds: ids }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Cluster could not be created.");
    await refresh();
  }, [isDemo, reports, clusters, user.name, refresh]);

  const updateCluster = useCallback(async (id: string, update: Partial<Pick<IssueCluster, "title" | "status" | "assignedTo">>, separateReportId?: string, resolutionMessage?: string) => {
    if (isDemo) {
      const now = new Date().toISOString();
      const cluster = clusters.find((item)=>item.id===id);
      const remainingIds = separateReportId ? cluster?.reportIds.filter((reportId)=>reportId!==separateReportId) || [] : [];
      setClusters((previous) => previous.map((item) => item.id !== id ? item : { ...item, ...update, reportIds: separateReportId ? item.reportIds.filter((reportId) => reportId !== separateReportId) : item.reportIds }).filter((item) => item.reportIds.length >= 2));
      if (separateReportId) setReports((previous) => previous.map((report) => report.id === separateReportId || (remainingIds.length === 1 && remainingIds.includes(report.id)) ? { ...report, clusterId: null, updatedAt: now, ...(report.id===separateReportId?{events:[{id:crypto.randomUUID(),actor:user.name,oldStatus:null,newStatus:null,message:`Separated from “${cluster?.title||"the issue cluster"}” after administrator review.`,createdAt:now},...report.events]}:{}) } : report));
      else if (update.status || update.assignedTo !== undefined) setReports((previous) => previous.map((report) => { if(report.clusterId!==id)return report; const message=resolutionMessage || (update.status&&update.status!==report.status?`Issue cluster “${update.title||cluster?.title||"Campus issue"}” moved to ${update.status}.`:update.assignedTo!==undefined?`Issue assignment updated to ${update.assignedTo||"unassigned"}.`:"Issue cluster updated."); const event={id:crypto.randomUUID(),actor:user.name,oldStatus:update.status&&update.status!==report.status?report.status:null,newStatus:update.status&&update.status!==report.status?update.status:null,message,createdAt:now}; return { ...report, ...(update.status ? { status: update.status } : {}), ...(update.assignedTo !== undefined ? { assignedTo: update.assignedTo } : {}), updatedAt: now, events:[event,...report.events] }; }));
      return;
    }
    const response = await fetch(`/api/admin/clusters/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...update, ...(separateReportId ? { action: "separate", reportId: separateReportId } : {}), ...(resolutionMessage ? { message: resolutionMessage } : {}) }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Cluster could not be updated.");
    await refresh();
  }, [isDemo, clusters, user.name, refresh]);

  const value = useMemo(() => ({ user, locale, setLocale, isDemo, reports, clusters, setDemoRole, resetDemo, signOut, submitReport, updateReport, createCluster, updateCluster, refresh }), [user, locale, setLocale, isDemo, reports, clusters, setDemoRole, resetDemo, signOut, submitReport, updateReport, createCluster, updateCluster, refresh]);
  return <WorkspaceContext.Provider value={value}>{ready ? children : null}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return value;
}
