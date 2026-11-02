"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AppUser, IssueCluster, Report, UserRole } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { InterfaceLanguage } from "@/lib/i18n";

const emptyUser = (preferredLanguage: InterfaceLanguage = "en"): AppUser => ({
  id: "",
  name: "Campus member",
  email: "",
  role: "student",
  department: null,
  preferredLanguage,
});

type SubmitReportInput = { originalText: string; building: string; area: string; category?: Report["category"]; publicOptOut?: boolean; image?: File; imageDraftToken?: string };
type WorkspaceContextValue = {
  user: AppUser;
  isAuthenticated: boolean;
  authReady: boolean;
  selectedReportId: string | null;
  openReport: (id: string) => void;
  closeReport: () => void;
  locale: InterfaceLanguage;
  setLocale: (locale: InterfaceLanguage) => Promise<void>;
  activateSession: () => Promise<UserRole>;
  /** Kept for shared presentation components; production sessions never enter demo mode. */
  isDemo: false;
  reports: Report[];
  clusters: IssueCluster[];
  signOut: () => Promise<void>;
  submitReport: (input: SubmitReportInput) => Promise<Report>;
  updateReport: (id: string, update: Partial<Pick<Report, "status" | "category" | "confirmedPriority" | "assignedTo" | "assignedDepartment">>, message?: string) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  createCluster: (title: string, ids: string[]) => Promise<void>;
  updateCluster: (id: string, update: Partial<Pick<IssueCluster, "title" | "status" | "assignedTo" | "assignedDepartment">>, separateReportId?: string, resolutionMessage?: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "The request could not be completed.");
  return body;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<InterfaceLanguage>("en");
  const [user, setUser] = useState<AppUser>(emptyUser);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [clusters, setClusters] = useState<IssueCluster[]>([]);
  const [ready, setReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const isDemo = false as const;

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    const response = await fetch("/api/reports", { cache: "no-store" });
    if (response.status === 401) {
      setIsAuthenticated(false);
      return;
    }
    const body = await readResponse<{ reports: Report[] }>(response);
    let nextReports = body.reports;
    if (user.role === "staff" && user.department) {
      const queueResponse = await fetch("/api/staff/queue", { cache: "no-store" });
      const queueBody = await readResponse<{ reports: Report[] }>(queueResponse);
      nextReports = [...new Map([...body.reports, ...queueBody.reports].map((report) => [report.id, report])).values()];
    }
    setReports(nextReports);
    if (user.role === "admin") {
      const clusterResponse = await fetch("/api/admin/clusters", { cache: "no-store" });
      const clusterBody = await readResponse<{ clusters: IssueCluster[] }>(clusterResponse);
      setClusters(clusterBody.clusters);
    } else setClusters([]);
  }, [isAuthenticated, user.role, user.department]);

  useEffect(() => {
    let active = true;
    let authVersion = 0;
    queueMicrotask(() => { if (active) setReady(true); });
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      try {
        if (window.localStorage.getItem("civicsense-locale") === "as") queueMicrotask(() => { if (active) setLocaleState("as"); });
      } catch { /* Storage can be unavailable in private browsing. */ }
      queueMicrotask(() => { if (active) setAuthReady(true); });
      return () => { active = false; };
    }

    const applyUser = async (id: string, expectedVersion: number) => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, role, preferred_language, department").eq("id", id).single();
      if (!active || expectedVersion !== authVersion) return;
      if (error || !data) {
        setIsAuthenticated(false);
        setUser(emptyUser());
        setReports([]);
        setClusters([]);
        return;
      }
      const preferredLanguage = data.preferred_language === "as" ? "as" : "en";
      setUser({ id: data.id, name: data.full_name, email: "", role: data.role as UserRole, department: data.department || null, preferredLanguage });
      setLocaleState(preferredLanguage);
      setIsAuthenticated(true);
    };

    void (async () => {
      const expectedVersion = authVersion;
      const { data, error } = await supabase.auth.getUser();
      if (!active || expectedVersion !== authVersion) return;
      if (!error && data.user) await applyUser(data.user.id, expectedVersion);
      else {
        setIsAuthenticated(false);
        try { if (window.localStorage.getItem("civicsense-locale") === "as") queueMicrotask(() => { if (active) setLocaleState("as"); }); } catch { /* Storage is optional. */ }
      }
      if (active && expectedVersion === authVersion) setAuthReady(true);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      authVersion += 1;
      const expectedVersion = authVersion;
      if (session?.user) {
        window.setTimeout(() => void applyUser(session.user.id, expectedVersion).finally(() => { if (active && expectedVersion === authVersion) setAuthReady(true); }), 0);
      } else {
        setIsAuthenticated(false);
        setUser(emptyUser());
        setReports([]);
        setClusters([]);
        setSelectedReportId(null);
        setAuthReady(true);
      }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = window.setTimeout(() => { void refresh().catch((error) => console.error("Workspace data could not be refreshed", error)); }, 0);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, refresh]);
  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = window.setInterval(() => { void refresh().catch((error) => console.error("Workspace data could not be refreshed", error)); }, 30_000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, refresh]);
  const hasPendingAnalysis = reports.some((report) => report.analysisStatus === "pending");
  useEffect(() => {
    if (!isAuthenticated || !hasPendingAnalysis) return;
    let active = true;
    let delay = 2_500;
    let timer: number;
    const poll = async () => {
      try { await refresh(); }
      catch (error) { console.error("Pending report status could not be refreshed", error); }
      if (!active) return;
      timer = window.setTimeout(() => { delay = Math.min(delay + 1_500, 10_000); void poll(); }, delay);
    };
    timer = window.setTimeout(() => void poll(), delay);
    return () => { active = false; window.clearTimeout(timer); };
  }, [isAuthenticated, hasPendingAnalysis, refresh]);

  const openReport = useCallback((id: string) => setSelectedReportId(id), []);
  const closeReport = useCallback(() => setSelectedReportId(null), []);
  const setLocale = useCallback(async (nextLocale: InterfaceLanguage) => {
    setLocaleState(nextLocale);
    try { window.localStorage.setItem("civicsense-locale", nextLocale); } catch { /* Language still changes for this session. */ }
    setUser((previous) => ({ ...previous, preferredLanguage: nextLocale }));
    if (!isAuthenticated || !user.id) return;
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      const { error } = await supabase.from("profiles").update({ preferred_language: nextLocale }).eq("id", user.id);
      if (error) throw new Error("Your language changed for this session but could not be saved to your account.");
    }
  }, [isAuthenticated, user.id]);

  const activateSession = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase authentication is not configured.");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("Your sign-in session could not be loaded. Please try again.");
    const { data: initialProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role, preferred_language, department")
      .eq("id", authData.user.id)
      .single();
    let profile = initialProfile;
    if (profileError || !profile) {
      const recovery = await fetch("/api/auth/profile", { method: "POST", cache: "no-store" });
      const recoveryBody = await recovery.json().catch(() => ({})) as { profile?: typeof profile; error?: string };
      if (!recovery.ok || !recoveryBody.profile) {
        await supabase.auth.signOut();
        setIsAuthenticated(false);
        setAuthReady(true);
        throw new Error(recoveryBody.error || "Your account profile could not be prepared. Apply the Supabase migrations and try again.");
      }
      profile = recoveryBody.profile;
    }
    const preferredLanguage = profile.preferred_language === "as" ? "as" : "en";
    setUser({ id: profile.id, name: profile.full_name, email: authData.user.email || "", role: profile.role as UserRole, department: profile.department || null, preferredLanguage });
    setLocaleState(preferredLanguage);
    setIsAuthenticated(true);
    setAuthReady(true);
    return profile.role as UserRole;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    setSelectedReportId(null);
    setReports([]);
    setClusters([]);
    setIsAuthenticated(false);
    setUser(emptyUser(locale));
  }, [locale]);

  const submitReport = useCallback(async (input: SubmitReportInput) => {
    const form = new FormData();
    form.set("originalText", input.originalText);
    form.set("building", input.building); form.set("area", input.area); if (input.category) form.set("category", input.category);
    form.set("publicOptOut", String(Boolean(input.publicOptOut)));
    if (input.image) form.set("image", input.image);
    if (input.imageDraftToken) form.set("imageDraftToken", input.imageDraftToken);
    const response = await fetch("/api/reports", { method: "POST", body: form });
    const body = await readResponse<{ report: Report }>(response);
    setReports((current) => [body.report, ...current.filter((report) => report.id !== body.report.id)]);
    return body.report;
  }, []);

  const updateReport = useCallback(async (id: string, update: Partial<Pick<Report, "status" | "category" | "confirmedPriority" | "assignedTo" | "assignedDepartment">>, message?: string) => {
    if (user.role !== "admin" && user.role !== "staff") throw new Error("You do not have access to update this report.");
    const endpoint = user.role === "staff" ? `/api/staff/reports/${id}` : `/api/admin/reports/${id}`;
    const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...update, message }) });
    await readResponse(response);
    await refresh();
  }, [user.role, refresh]);

  const deleteReport = useCallback(async (id: string) => {
    const response = await fetch(`/api/reports/${id}`, { method: "DELETE" });
    await readResponse(response);
    setReports((current) => current.filter((report) => report.id !== id));
  }, []);

  const createCluster = useCallback(async (title: string, ids: string[]) => {
    if (ids.length < 2) throw new Error("Choose at least two reports to create an issue cluster.");
    if (user.role !== "admin") throw new Error("Administrator access is required to create a cluster.");
    const response = await fetch("/api/admin/clusters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, reportIds: ids }) });
    await readResponse(response);
    await refresh();
  }, [user.role, refresh]);

  const updateCluster = useCallback(async (id: string, update: Partial<Pick<IssueCluster, "title" | "status" | "assignedTo" | "assignedDepartment">>, separateReportId?: string, resolutionMessage?: string) => {
    if (user.role !== "admin") throw new Error("Administrator access is required to update a cluster.");
    const response = await fetch(`/api/admin/clusters/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...update, ...(separateReportId ? { action: "separate", reportId: separateReportId } : {}), ...(resolutionMessage ? { message: resolutionMessage } : {}) }) });
    await readResponse(response);
    await refresh();
  }, [user.role, refresh]);

  const value = useMemo(() => ({ user, isAuthenticated, authReady, selectedReportId, openReport, closeReport, locale, setLocale, activateSession, isDemo, reports, clusters, signOut, submitReport, updateReport, deleteReport, createCluster, updateCluster, refresh }), [user, isAuthenticated, authReady, selectedReportId, openReport, closeReport, locale, setLocale, activateSession, isDemo, reports, clusters, signOut, submitReport, updateReport, deleteReport, createCluster, updateCluster, refresh]);
  return <WorkspaceContext.Provider value={value}>{ready ? children : null}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return value;
}
