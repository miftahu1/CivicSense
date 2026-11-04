"use client";

import { useEffect, useState } from "react";
import { Activity, Check, CircleAlert, CircleCheck, Clock3, Copy, ImagePlus, Play, RotateCcw, Server, Sparkles, XCircle } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { categoryLabel, languageLabel, tr } from "@/lib/i18n";
import { categories, type Language } from "@/lib/types";
import type { CampusLocation } from "@/lib/campus-locations";

type DiagnosticEvent = {
  type?: "started" | "step" | "finished" | "fatal";
  name?: string;
  status?: "running" | "complete" | "failed" | "skipped";
  durationMs?: number;
  elapsedMs?: number;
  result?: unknown;
  error?: string;
  reason?: string;
  totalDurationMs?: number;
  analysisSucceeded?: boolean;
  embeddingSucceeded?: boolean;
  databaseSucceeded?: boolean;
  model?: string;
  embeddingModel?: string;
  category?: string;
  timeoutMs?: number;
  attempts?: number;
  authDurationMs?: number;
  inputPreparationMs?: number;
  savedToDatabase?: boolean;
  note?: string;
};

type StepLog = DiagnosticEvent & { name: string; receivedAt: string; clientStartedAt?: number };

const languages: Language[] = ["English", "Assamese", "Romanised Assamese", "Mixed"];

const stepNames: Record<string, string> = {
  "Admin authorization": "প্ৰশাসকৰ প্ৰমাণীকৰণ",
  "Request validation": "অনুৰোধৰ তথ্য পৰীক্ষা",
  "Supabase read check": "Supabase পঢ়াৰ পৰীক্ষা",
  "Gemini report analysis": "Gemini প্ৰতিবেদন বিশ্লেষণ",
  "Gemini embedding": "Gemini এম্বেডিং তৈয়াৰ",
  "Supabase similarity search": "Supabase-ত সদৃশ প্ৰতিবেদন বিচৰা",
  "Gemini image analysis": "Gemini ছবিৰ বিশ্লেষণ",
  "Application GET /api/reports": "এপ্লিকেচনৰ GET /api/reports",
};

const englishSample = "Water has not reached the third floor of the hostel since this morning. Several students are affected.";
const assameseSample = "আজি পুৱাৰে পৰা ছাত্ৰাৱাসৰ তৃতীয় মহলাত পানী যোগান ধৰা হোৱা নাই। ইয়াৰ ফলত কেইবাজনো শিক্ষাৰ্থী অসুবিধাত পৰিছে।";

function sampleForLanguage(language: Language) {
  if (language === "Assamese") return assameseSample;
  if (language === "Romanised Assamese") return "Aji puware pora chatrabashor tritiyo mahalat pani jogan dhora hua nai. Iyar folot keibajono shikharthi osubidhat porise.";
  if (language === "Mixed") return `${assameseSample}\n\n${englishSample}`;
  return englishSample;
}

export function AiDiagnostics() {
  const { locale } = useWorkspace();
  const text = (english: string, assamese: string) => tr(locale, english, assamese);
  const [model, setModel] = useState("gemini-3.6-flash");
  const [embeddingModel, setEmbeddingModel] = useState("gemini-embedding-2");
  const [geminiKeyConfigured, setGeminiKeyConfigured] = useState<boolean | null>(null);
  const [keySlot, setKeySlot] = useState<"primary" | "backup">("primary");
  const [backupKeyConfigured, setBackupKeyConfigured] = useState(false);
  const [keySaving, setKeySaving] = useState(false);
  const [language, setLanguage] = useState<Language>(() => locale === "as" ? "Assamese" : "English");
  const [languageEdited, setLanguageEdited] = useState(false);
  const [title, setTitle] = useState("");
  const [originalText, setOriginalText] = useState(() => sampleForLanguage(locale === "as" ? "Assamese" : "English"));
  const [originalTextEdited, setOriginalTextEdited] = useState(false);
  const [campusLocations, setCampusLocations] = useState<CampusLocation[]>([]);
  const [building, setBuilding] = useState("");
  const [area, setArea] = useState(() => locale === "as" ? "তৃতীয় মহলা" : "Third floor");
  const [areaEdited, setAreaEdited] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/workspace/campus-locations", { cache: "no-store" }).then(async (response) => {
      const body = await response.json() as { locations?: CampusLocation[] };
      if (response.ok && active) setCampusLocations(body.locations || []);
    }).catch((error) => console.error("Campus locations could not be loaded for diagnostics", error));
    return () => { active = false; };
  }, []);
  const effectiveBuilding = building || campusLocations[0]?.name || "";
  const [category, setCategory] = useState("");
  const [image, setImage] = useState<File | undefined>();
  const [timeoutMs, setTimeoutMs] = useState(30_000);
  const [attempts, setAttempts] = useState(2);
  const [running, setRunning] = useState(false);
  const [includeReportList, setIncludeReportList] = useState(true);
  const [steps, setSteps] = useState<StepLog[]>([]);
  const [error, setError] = useState("");
  const [totalDurationMs, setTotalDurationMs] = useState<number | null>(null);
  const [clockNow, setClockNow] = useState(0);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [logsCopied, setLogsCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  const statusLabel = (status?: DiagnosticEvent["status"]) => {
    if (locale === "en") return status?.toUpperCase() || "LOG";
    return status === "running" ? "চলি আছে" : status === "complete" ? "সম্পূৰ্ণ" : status === "failed" ? "বিফল" : status === "skipped" ? "এৰি দিয়া হৈছে" : "লগ";
  };
  const stepLabel = (name: string) => locale === "as" ? stepNames[name] || name : name;
  const localizeResult = (result: unknown) => {
    if (locale !== "as") return result;
    if (result === "Authenticated as administrator.") return text("Authenticated as administrator.", "প্ৰশাসক হিচাপে প্ৰমাণীকৰণ সম্পূৰ্ণ।");
    if (result && typeof result === "object" && !Array.isArray(result)) {
      const record = result as Record<string, unknown>;
      if (record.selectedCategory === "No category hint") return { ...record, selectedCategory: text("No category hint", "কোনো শ্ৰেণীৰ ইংগিত নাই") };
    }
    return result;
  };
  const consoleText = [
    `${text("CivicSense AI diagnostics", "CivicSense এআই ব্যৱস্থাৰ পৰীক্ষা")} · ${new Date().toLocaleString(locale === "as" ? "as-IN" : "en-IN")}`,
    `${text("Requested analysis model", "নিৰ্বাচিত বিশ্লেষণ মডেল")}: ${model || "—"}`,
    `${text("Timeout / attempts", "সময়সীমা / চেষ্টা")}: ${timeoutMs / 1000}s · ${attempts}`,
    ...steps.map((step) => {
      const duration = step.durationMs === undefined ? "" : ` · ${(step.durationMs / 1000).toFixed(2)}s`;
      const status = statusLabel(step.status);
      const details = step.error
        ? `\n  ${text("Error", "ত্ৰুটি")}: ${step.error}`
        : step.reason
          ? `\n  ${locale === "as" && step.reason === "Embedding step failed." ? "এম্বেডিংৰ ধাপটো বিফল হ’ল।" : locale === "as" && step.reason === "No image selected." ? "কোনো ছবি বাছনি কৰা হোৱা নাই।" : step.reason}`
          : step.result !== undefined
            ? `\n${JSON.stringify(localizeResult(step.result), null, 2).split("\n").map((line) => `  ${line}`).join("\n")}`
            : "";
      return `[${step.receivedAt}] ${status} ${stepLabel(step.name)}${duration}${details}`;
    }),
    ...(error ? [`${text("Request error", "অনুৰোধৰ ত্ৰুটি")}: ${error}`] : []),
    ...(totalDurationMs !== null ? [`${text("Total elapsed", "মুঠ সময়")}: ${(totalDurationMs / 1000).toFixed(2)}s`] : []),
  ].join("\n\n");

  useEffect(() => {
    const timer = window.setTimeout(() => {
    const preferredLanguage: Language = locale === "as" ? "Assamese" : "English";
    if (!languageEdited && !originalTextEdited) {
      setLanguage(preferredLanguage);
      setOriginalText(sampleForLanguage(preferredLanguage));
    }
    if (!areaEdited) setArea(locale === "as" ? "তৃতীয় মহলা" : "Third floor");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [locale, languageEdited, originalTextEdited, areaEdited]);

  useEffect(() => {
    fetch("/api/admin/ai-diagnostics", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load diagnostic defaults.");
        setModel(body.analysisModel);
        setEmbeddingModel(body.embeddingModel);
        setGeminiKeyConfigured(body.geminiKeyConfigured);
        const keyResponse = await fetch("/api/admin/ai-key", { cache: "no-store" });
        const keyBody = await keyResponse.json();
        if (!keyResponse.ok) throw new Error(keyBody.error || "Could not load Gemini key settings.");
        setKeySlot(keyBody.slot);
        setBackupKeyConfigured(keyBody.backupConfigured);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load diagnostic defaults."));
  }, []);

  async function changeKeySlot(slot: "primary" | "backup") {
    setKeySaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/ai-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not change Gemini key.");
      setKeySlot(slot);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not change Gemini key."); }
    finally { setKeySaving(false); }
  }

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [running]);

  function handleEvent(event: DiagnosticEvent) {
    if (event.type === "started") {
      setError("");
      const startedSteps: StepLog[] = [
        { name: "Admin authorization", type: "step", status: "complete", durationMs: event.authDurationMs, result: "Authenticated as administrator.", receivedAt: new Date().toLocaleTimeString(locale === "as" ? "as-IN" : "en-IN") },
        { name: "Request validation", type: "step", status: "complete", durationMs: event.inputPreparationMs, result: { reportFieldsAccepted: true, selectedCategory: event.category || "No category hint", reportPersisted: event.savedToDatabase === true }, receivedAt: new Date().toLocaleTimeString(locale === "as" ? "as-IN" : "en-IN") },
      ];
      setSteps(startedSteps);
      return;
    }
    if (event.type === "fatal") {
      setError(event.error || "The diagnostics run failed.");
      setTotalDurationMs(event.totalDurationMs ?? null);
      return;
    }
    if (event.type === "finished") {
      setTotalDurationMs(event.totalDurationMs ?? null);
      return;
    }
    if (event.type !== "step" || !event.name) return;
    setSteps((current) => {
      const updated: StepLog = { ...event, name: event.name!, receivedAt: new Date().toLocaleTimeString(locale === "as" ? "as-IN" : "en-IN"), ...(event.status === "running" ? { clientStartedAt: Date.now() } : {}) };
      const existingIndex = current.findIndex((step) => step.name === event.name);
      if (existingIndex < 0) return [...current, updated];
      return current.map((step, index) => index === existingIndex ? updated : step);
    });
  }

  async function runDiagnostics(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running) return;
    setRunning(true);
    setError("");
    setSteps([]);
    setTotalDurationMs(null);
    const startedAt = Date.now();
    setRunStartedAt(startedAt);
    setClockNow(startedAt);

    const form = new FormData();
    form.set("model", model.trim());
    form.set("embeddingModel", embeddingModel.trim());
    form.set("language", language);
    form.set("title", title.trim());
    form.set("originalText", originalText.trim());
    form.set("building", effectiveBuilding.trim());
    form.set("area", area.trim());
    form.set("category", category);
    form.set("timeoutMs", String(timeoutMs));
    form.set("attempts", String(attempts));
    if (image) form.set("image", image);

    try {
      const response = await fetch("/api/admin/ai-diagnostics", { method: "POST", body: form });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Diagnostics request failed (${response.status}).`);
      }
      if (!response.body) throw new Error("The server did not open a diagnostics event stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const item of events) {
          const dataLine = item.split("\n").find((line) => line.startsWith("data: "));
          if (!dataLine) continue;
          handleEvent(JSON.parse(dataLine.slice(6)) as DiagnosticEvent);
        }
        if (done) break;
      }
      if (buffer.startsWith("data: ")) handleEvent(JSON.parse(buffer.slice(6)) as DiagnosticEvent);
      if (includeReportList) {
        const startedAt = performance.now();
        handleEvent({ type: "step", name: "Application GET /api/reports", status: "running" });
        try {
          const reportsResponse = await fetch("/api/reports", { cache: "no-store" });
          const reportsBody = await reportsResponse.json().catch(() => ({}));
          if (!reportsResponse.ok) throw new Error(reportsBody.error || `Report-list request failed (${reportsResponse.status}).`);
          handleEvent({ type: "step", name: "Application GET /api/reports", status: "complete", durationMs: performance.now() - startedAt, result: { reportsReturned: reportsBody.reports?.length ?? null, count: reportsBody.count ?? null, status: reportsResponse.status } });
        } catch (caught) {
          handleEvent({ type: "step", name: "Application GET /api/reports", status: "failed", durationMs: performance.now() - startedAt, error: caught instanceof Error ? caught.message : "Report-list request failed." });
        }
      }
      setRunning(false);
      setTotalDurationMs(Date.now() - startedAt);
      setRunStartedAt(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The diagnostics request failed.");
      setRunning(false);
      setRunStartedAt(null);
    }
  }

  function clearResults() {
    if (running) return;
    setSteps([]);
    setError("");
    setTotalDurationMs(null);
    setRunStartedAt(null);
    setLogsCopied(false);
    setCopyError("");
  }

  async function copyConsoleLogs() {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(consoleText);
      setLogsCopied(true);
      window.setTimeout(() => setLogsCopied(false), 1800);
    } catch {
      setCopyError("Clipboard access was blocked. Select the console text and copy it manually.");
    }
  }

  return <div className="diagnostics-page" lang={locale}>
    <div className="page-heading">
      <div><div className="section-kicker">{text("Administrator workspace · Provider diagnostics", "প্ৰশাসকৰ কৰ্মক্ষেত্ৰ · সেৱা প্ৰদানকাৰীৰ পৰীক্ষা")}</div><h1>{text("AI diagnostics", "এআই ব্যৱস্থাৰ পৰীক্ষা")}</h1><p>{text("Run the report pipeline with controlled inputs, then inspect each provider and database step as it finishes.", "নিয়ন্ত্ৰিত তথ্যৰে প্ৰতিবেদনৰ প্ৰক্ৰিয়াটো চলাওক আৰু সেৱা প্ৰদানকাৰী তথা ডেটাবেছৰ প্ৰতিটো ধাপৰ ফলাফল চাওক।")}</p></div>
      <div className="heading-actions"><span className="status-pill status-progress"><Activity size={13}/> {text("Admin only", "কেৱল প্ৰশাসকৰ বাবে")}</span></div>
    </div>

    <div className="diagnostics-notice"><CircleAlert size={18}/><div><strong>{geminiKeyConfigured === false ? text("GEMINI_API_KEY is missing on the server.", "চাৰ্ভাৰত GEMINI_API_KEY ছেট কৰা হোৱা নাই।") : text("Diagnostic calls use your configured Gemini API key.", "পৰীক্ষাৰ API আহ্বানসমূহে আপোনাৰ ছেট কৰা Gemini API key ব্যৱহাৰ কৰে।")}</strong><span>{text("They may incur API usage charges. No report, attachment, or embedding is saved. Similarity search reads the existing report index. The category field is logged as the selected hint; the current production analyzer can replace that category.", "এই API আহ্বানসমূহৰ বাবে মাচুল লাগিব পাৰে। কোনো প্ৰতিবেদন, সংলগ্ন ছবি বা এম্বেডিং সংৰক্ষণ নহয়। সদৃশ প্ৰতিবেদন বিচাৰিবলৈ বৰ্তমানৰ সূচীহে পঢ়া হয়। বাছনি কৰা শ্ৰেণীটো কেৱল ইংগিত হিচাপে লগ কৰা হয়; মূল বিশ্লেষকে ইয়াক সলনি কৰিব পাৰে।")}</span></div></div>

    <section className="panel diagnostics-form"><div className="diagnostics-panel-heading"><div><div className="section-kicker">{text("Provider credentials", "সেৱা প্ৰদানকাৰীৰ প্ৰৱেশ তথ্য")}</div><h2>{text("Gemini API key", "Gemini API key")}</h2><p>{text("Choose which Google account’s key powers new Gemini calls. Model fallback remains within the selected account.", "নতুন Gemini API আহ্বানৰ বাবে কোনটো Google একাউণ্টৰ key ব্যৱহাৰ হ’ব বাছনি কৰক। বিকল্প মডেলো সেই একাউণ্টৰ পৰাই ব্যৱহাৰ কৰা হ’ব।")}</p></div></div><div className="diagnostics-field-grid"><label>{text("Active key", "সক্ৰিয় key")}<select value={keySlot} disabled={keySaving || !backupKeyConfigured} onChange={(event) => void changeKeySlot(event.target.value as "primary" | "backup")}><option value="primary">{text("Primary Google account", "প্ৰাথমিক Google একাউণ্ট")}</option><option value="backup">{text("Backup Google account", "বিকল্প Google একাউণ্ট")}</option></select><small>{backupKeyConfigured ? text("Switches the key used for image analysis, report analysis and embeddings.", "ছবি বিশ্লেষণ, প্ৰতিবেদন বিশ্লেষণ আৰু এম্বেডিঙৰ বাবে ব্যৱহৃত key সলনি কৰে।") : text("Configure BACKUP_GEMINI_API_KEY on the server to enable the backup account.", "বিকল্প একাউণ্ট সক্ৰিয় কৰিবলৈ চাৰ্ভাৰত BACKUP_GEMINI_API_KEY নিৰ্ধাৰণ কৰক।")}</small></label></div></section>

    <div className="diagnostics-grid">
      <form className="panel diagnostics-form" onSubmit={(event) => void runDiagnostics(event)}>
        <div className="diagnostics-panel-heading"><div><div className="section-kicker">{text("Test configuration", "পৰীক্ষাৰ বিন্যাস")}</div><h2>{text("Choose the request", "অনুৰোধৰ তথ্য বাছনি কৰক")}</h2></div><Sparkles size={19}/></div>
        <div className="diagnostics-field-grid">
          <label>{text("Analysis model", "বিশ্লেষণৰ মডেল")}<input value={model} onChange={(event) => setModel(event.target.value)} maxLength={120} required spellCheck={false}/><small>{text("Defaults to the server’s GEMINI_MODEL.", "অন্যথা চাৰ্ভাৰৰ GEMINI_MODEL ব্যৱহাৰ কৰা হয়।")}</small></label>
          <label>{text("Embedding model", "এম্বেডিং মডেল")}<input value={embeddingModel} onChange={(event) => setEmbeddingModel(event.target.value)} maxLength={120} required spellCheck={false}/><small>{text("Defaults to GEMINI_EMBEDDING_MODEL.", "অন্যথা GEMINI_EMBEDDING_MODEL ব্যৱহাৰ কৰা হয়।")}</small></label>
          <label>{text("Source language", "মূল ভাষা")}<select value={language} onChange={(event) => { const next = event.target.value as Language; setLanguage(next); setLanguageEdited(true); if (!originalTextEdited) setOriginalText(sampleForLanguage(next)); }}>{languages.map((item) => <option key={item} value={item}>{languageLabel(item, locale)}</option>)}</select></label>
          <label>{text("Reporter category hint", "প্ৰতিবেদনকাৰীৰ শ্ৰেণীৰ ইংগিত")}<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">{text("No category hint", "কোনো শ্ৰেণীৰ ইংগিত নাই")}</option>{categories.map((item) => <option key={item} value={item}>{categoryLabel(item, locale)}</option>)}</select></label>
          <label>{text("Building / campus area", "ভৱন / কেম্পাছৰ এলেকা")}<select value={effectiveBuilding} onChange={(event) => setBuilding(event.target.value)}>{campusLocations.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
          <label>{text("Room, floor, landmark", "কোঠা, মহলা বা চিনাকি ঠাই")}<input value={area} onChange={(event) => { setArea(event.target.value); setAreaEdited(true); }} maxLength={120}/></label>
          <label>{text("Timeout", "সময়সীমা")}<select value={timeoutMs} onChange={(event) => setTimeoutMs(Number(event.target.value))}><option value={10_000}>{text("10 seconds", "১০ ছেকেণ্ড")}</option><option value={30_000}>{text("30 seconds", "৩০ ছেকেণ্ড")}</option><option value={60_000}>{text("60 seconds", "৬০ ছেকেণ্ড")}</option><option value={120_000}>{text("120 seconds", "১২০ ছেকেণ্ড")}</option></select></label>
          <label>{text("Attempts", "চেষ্টাৰ সংখ্যা")}<select value={attempts} onChange={(event) => setAttempts(Number(event.target.value))}><option value={1}>{text("1 · no retry", "১ · পুনৰ চেষ্টা নাই")}</option><option value={2}>{text("2 · one retry", "২ · এবাৰ পুনৰ চেষ্টা")}</option><option value={3}>{text("3 · two retries", "৩ · দুবাৰ পুনৰ চেষ্টা")}</option></select></label>
        </div>
        <label className="diagnostics-full-field">{text("Title / context (optional)", "শিৰোনাম / প্ৰসংগ (ঐচ্ছিক)")}<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder={text("Short issue title to include in the test prompt", "পৰীক্ষাৰ প্ৰম্পটত যোগ কৰিবলৈ সমস্যাৰ চমু শিৰোনাম")}/><small>{text("The live report form has no separate title field; report titles are generated from the description.", "প্ৰকৃত প্ৰতিবেদন প্ৰপত্ৰত শিৰোনামৰ বাবে সুকীয়া ক্ষেত্ৰ নাই; বিৱৰণৰ পৰা শিৰোনাম তৈয়াৰ হয়।")}</small></label>
        <label className="diagnostics-full-field">{text("Report details", "প্ৰতিবেদনৰ বিৱৰণ")}<textarea value={originalText} onChange={(event) => { setOriginalText(event.target.value); setOriginalTextEdited(true); }} minLength={10} maxLength={5000} required rows={5}/><small>{originalText.length.toLocaleString(locale === "as" ? "as-IN" : "en-IN")} / 5,000 {text("characters", "আখৰ")}</small></label>
        <label className="diagnostics-full-field diagnostics-image-field"><span><ImagePlus size={16}/> {text("Optional image analysis", "ছবিৰ বিশ্লেষণ (ঐচ্ছিক)")}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={(event) => setImage(event.target.files?.[0])}/>{image && <small>{image.name} · {(image.size / 1024 / 1024).toFixed(2)} MB</small>}</label>
        <label className="diagnostics-checkbox"><input type="checkbox" checked={includeReportList} onChange={(event) => setIncludeReportList(event.target.checked)}/> {text("Also time the live", "প্ৰকৃত") } <code>GET /api/reports</code> {text("endpoint", "endpoint-টোৰ সময়ো জুখক")}</label>
        <div className="diagnostics-form-footer"><span>{text("Runs analysis, embedding, a read-only Supabase check, matching, and image analysis if selected.", "বিশ্লেষণ, এম্বেডিং, কেৱল-পঢ়িব পৰা Supabase পৰীক্ষা আৰু মিল বিচাৰে; ছবি বাছিলে ছবিও বিশ্লেষণ কৰে।")}</span><button className="button button-primary" disabled={running}><Play size={15}/>{running ? text("Running diagnostics…", "পৰীক্ষা চলি আছে…") : text("Run diagnostics", "পৰীক্ষা চলাওক")}</button></div>
      </form>

      <section className="diagnostics-results" aria-live="polite">
        <div className="panel diagnostics-run-summary">
          <div className="diagnostics-panel-heading"><div><div className="section-kicker">{text("Live run", "চলি থকা পৰীক্ষা")}</div><h2>{running ? text("Request in progress", "অনুৰোধ চলি আছে") : totalDurationMs !== null ? text("Run complete", "পৰীক্ষা সম্পূৰ্ণ") : text("Ready to test", "পৰীক্ষাৰ বাবে সাজু")}</h2></div><button type="button" className="button button-outline button-small" disabled={running || !steps.length && !error} onClick={clearResults}><RotateCcw size={14}/> {text("Clear", "মচি পেলাওক")}</button></div>
          <div className="diagnostics-summary-stats"><div><span>{text("Analysis model", "বিশ্লেষণৰ মডেল")}</span><strong>{model || "—"}</strong></div><div><span>{text("Timeout / attempts", "সময়সীমা / চেষ্টা")}</span><strong>{timeoutMs / 1000}s · {attempts}</strong></div><div><span>{text("Total elapsed", "মুঠ সময়")}</span><strong>{running && runStartedAt ? `${((clockNow - runStartedAt) / 1000).toFixed(1)}s` : totalDurationMs !== null ? `${(totalDurationMs / 1000).toFixed(2)}s` : "—"}</strong></div></div>
          {error && <div className="diagnostics-error"><XCircle size={16}/><span>{error}</span></div>}
          {totalDurationMs !== null && <div className="diagnostics-success"><CircleCheck size={16}/><span>{text("Run finished. Review step timings and errors below.", "পৰীক্ষা শেষ। তলত প্ৰতিটো ধাপৰ সময় আৰু ত্ৰুটি চাওক।")}</span></div>}
        </div>

        <div className="panel diagnostics-step-panel">
          <div className="diagnostics-panel-heading"><div><div className="section-kicker">{text("Execution trace", "কাৰ্যপ্ৰবাহৰ বিৱৰণ")}</div><h2>{text("What happened", "কি ঘটিল")}</h2></div><Clock3 size={18}/></div>
          {!steps.length && !running ? <div className="diagnostics-empty"><Server size={22}/><p>{text("Start a run to see live status, duration, output, and any provider error for each step.", "পৰীক্ষা আৰম্ভ কৰিলে প্ৰতিটো ধাপৰ স্থিতি, সময়, ফলাফল আৰু সেৱা প্ৰদানকাৰীৰ ত্ৰুটি ইয়াত দেখা যাব।")}</p></div> : <ol className="diagnostics-step-list">{steps.map((step) => <li key={step.name} className={`diagnostics-step diagnostics-${step.status}`}><div className="diagnostics-step-top"><div><span className="diagnostics-step-indicator">{step.status === "complete" ? <CircleCheck size={15}/> : step.status === "failed" ? <XCircle size={15}/> : step.status === "running" ? <span className="diagnostics-spinner"/> : <span>—</span>}</span><strong>{stepLabel(step.name)}</strong></div><span>{step.status === "running" ? `${((clockNow - (step.clientStartedAt || clockNow)) / 1000).toFixed(1)}s · ${statusLabel(step.status)}` : `${step.durationMs !== undefined ? `${(step.durationMs / 1000).toFixed(2)}s · ` : ""}${statusLabel(step.status)}`}</span></div>{step.error && <pre className="diagnostics-step-error">{step.error}</pre>}{step.reason && <p className="diagnostics-step-reason">{locale === "as" && step.reason === "Embedding step failed." ? "এম্বেডিংৰ ধাপটো বিফল হ’ল।" : locale === "as" && step.reason === "No image selected." ? "কোনো ছবি বাছনি কৰা হোৱা নাই।" : step.reason}</p>}{step.result !== undefined && <pre className="diagnostics-step-result">{JSON.stringify(localizeResult(step.result), null, 2)}</pre>}</li>)}</ol>}
        </div>
      </section>
    </div>

    <section className="panel diagnostics-console" aria-label={text("Copyable diagnostics console", "নকল কৰিব পৰা পৰীক্ষাৰ লগ") }>
      <div className="diagnostics-console-heading">
        <div><div className="section-kicker">{text("Run output", "পৰীক্ষাৰ ফলাফল")}</div><h2>{text("Diagnostic console", "পৰীক্ষাৰ লগ")}</h2></div>
        <button type="button" className="button button-outline button-small" onClick={() => void copyConsoleLogs()} disabled={!steps.length && !error}>
          {logsCopied ? <Check size={14}/> : <Copy size={14}/>}{logsCopied ? text("Copied", "নকল কৰা হ’ল") : text("Copy logs", "লগ নকল কৰক")}
        </button>
      </div>
      {copyError && <p className="diagnostics-console-copy-error">{text("Clipboard access was blocked. Select the console text and copy it manually.", "ক্লিপবৰ্ড ব্যৱহাৰ কৰিব পৰা নগ’ল। লগৰ লিখনী বাছি নিজে নকল কৰক।")}</p>}
      <pre className="diagnostics-console-output" tabIndex={0}>{steps.length || error ? consoleText : text("Run diagnostics to populate a timestamped, copyable log of each step, its duration, output, and errors.", "পৰীক্ষা চলালে প্ৰতিটো ধাপ, সময়, ফলাফল আৰু ত্ৰুটিৰ সময়সহ নকল কৰিব পৰা লগ ইয়াত দেখা যাব।")}</pre>
    </section>
  </div>;
}
