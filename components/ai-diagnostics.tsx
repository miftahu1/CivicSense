"use client";

import { useEffect, useState } from "react";
import { Activity, Check, CircleAlert, CircleCheck, Clock3, Copy, ImagePlus, Play, RotateCcw, Server, Sparkles, XCircle } from "lucide-react";
import { categories, type Language } from "@/lib/types";

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
const buildings = ["Student Hostel", "Central Library", "Academic Building", "Commerce Building", "Dining Hall", "Administration Building", "Health Centre", "Science Building", "Campus Grounds", "Other"];

export function AiDiagnostics() {
  const [model, setModel] = useState("gemini-3.6-flash");
  const [embeddingModel, setEmbeddingModel] = useState("gemini-embedding-2");
  const [geminiKeyConfigured, setGeminiKeyConfigured] = useState<boolean | null>(null);
  const [keySlot, setKeySlot] = useState<"primary" | "backup">("primary");
  const [backupKeyConfigured, setBackupKeyConfigured] = useState(false);
  const [keySaving, setKeySaving] = useState(false);
  const [language, setLanguage] = useState<Language>("English");
  const [title, setTitle] = useState("");
  const [originalText, setOriginalText] = useState("Water has not reached the third floor of the hostel since this morning. Several students are affected.");
  const [building, setBuilding] = useState("Student Hostel");
  const [area, setArea] = useState("Third floor");
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

  const consoleText = [
    `CivicSense AI diagnostics · ${new Date().toLocaleString()}`,
    `Requested analysis model: ${model || "—"}`,
    `Timeout / attempts: ${timeoutMs / 1000}s · ${attempts}`,
    ...steps.map((step) => {
      const duration = step.durationMs === undefined ? "" : ` · ${(step.durationMs / 1000).toFixed(2)}s`;
      const status = step.status?.toUpperCase() || "LOG";
      const details = step.error
        ? `\n  Error: ${step.error}`
        : step.reason
          ? `\n  ${step.reason}`
          : step.result !== undefined
            ? `\n${JSON.stringify(step.result, null, 2).split("\n").map((line) => `  ${line}`).join("\n")}`
            : "";
      return `[${step.receivedAt}] ${status} ${step.name}${duration}${details}`;
    }),
    ...(error ? [`Request error: ${error}`] : []),
    ...(totalDurationMs !== null ? [`Total elapsed: ${(totalDurationMs / 1000).toFixed(2)}s`] : []),
  ].join("\n\n");

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
        { name: "Admin authorization", type: "step", status: "complete", durationMs: event.authDurationMs, result: "Authenticated as administrator.", receivedAt: new Date().toLocaleTimeString() },
        { name: "Request validation", type: "step", status: "complete", durationMs: event.inputPreparationMs, result: { reportFieldsAccepted: true, selectedCategory: event.category || "No category hint", reportPersisted: event.savedToDatabase === true }, receivedAt: new Date().toLocaleTimeString() },
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
      const updated: StepLog = { ...event, name: event.name!, receivedAt: new Date().toLocaleTimeString(), ...(event.status === "running" ? { clientStartedAt: Date.now() } : {}) };
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
    form.set("building", building.trim());
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

  return <div className="diagnostics-page">
    <div className="page-heading">
      <div><div className="section-kicker">Administrator workspace · Provider diagnostics</div><h1>AI diagnostics</h1><p>Run the report pipeline with controlled inputs, then inspect each provider and database step as it finishes.</p></div>
      <div className="heading-actions"><span className="status-pill status-progress"><Activity size={13}/> Admin only</span></div>
    </div>

    <div className="diagnostics-notice"><CircleAlert size={18}/><div><strong>{geminiKeyConfigured === false ? "GEMINI_API_KEY is missing on the server." : "Diagnostic calls use your configured Gemini API key."}</strong><span>They may incur API usage charges. No report, attachment, or embedding is saved. Similarity search reads the existing report index. The category field is logged as the selected hint; the current production analyzer can replace that category.</span></div></div>

    <section className="panel diagnostics-form"><div className="diagnostics-panel-heading"><div><div className="section-kicker">Provider credentials</div><h2>Gemini API key</h2><p>Choose which Google account’s key powers new Gemini calls. Model fallback remains within the selected account.</p></div></div><div className="diagnostics-field-grid"><label>Active key<select value={keySlot} disabled={keySaving || !backupKeyConfigured} onChange={(event) => void changeKeySlot(event.target.value as "primary" | "backup")}><option value="primary">Primary Google account</option><option value="backup">Backup Google account</option></select><small>{backupKeyConfigured ? "Switches the key used for image analysis, report analysis and embeddings." : "Configure BACKUP_GEMINI_API_KEY on the server to enable the backup account."}</small></label></div></section>

    <div className="diagnostics-grid">
      <form className="panel diagnostics-form" onSubmit={(event) => void runDiagnostics(event)}>
        <div className="diagnostics-panel-heading"><div><div className="section-kicker">Test configuration</div><h2>Choose the request</h2></div><Sparkles size={19}/></div>
        <div className="diagnostics-field-grid">
          <label>Analysis model<input value={model} onChange={(event) => setModel(event.target.value)} maxLength={120} required spellCheck={false}/><small>Defaults to the server’s GEMINI_MODEL.</small></label>
          <label>Embedding model<input value={embeddingModel} onChange={(event) => setEmbeddingModel(event.target.value)} maxLength={120} required spellCheck={false}/><small>Defaults to GEMINI_EMBEDDING_MODEL.</small></label>
          <label>Source language<select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>{languages.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Reporter category hint<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">No category hint</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Building / campus area<select value={building} onChange={(event) => setBuilding(event.target.value)}>{buildings.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Room, floor, landmark<input value={area} onChange={(event) => setArea(event.target.value)} maxLength={120}/></label>
          <label>Timeout<select value={timeoutMs} onChange={(event) => setTimeoutMs(Number(event.target.value))}><option value={10_000}>10 seconds</option><option value={30_000}>30 seconds</option><option value={60_000}>60 seconds</option><option value={120_000}>120 seconds</option></select></label>
          <label>Attempts<select value={attempts} onChange={(event) => setAttempts(Number(event.target.value))}><option value={1}>1 · no retry</option><option value={2}>2 · one retry</option><option value={3}>3 · two retries</option></select></label>
        </div>
        <label className="diagnostics-full-field">Title / context (optional)<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Short issue title to include in the test prompt"/><small>The live report form has no separate title field; report titles are generated from the description.</small></label>
        <label className="diagnostics-full-field">Report details<textarea value={originalText} onChange={(event) => setOriginalText(event.target.value)} minLength={10} maxLength={5000} required rows={5}/><small>{originalText.length.toLocaleString()} / 5,000 characters</small></label>
        <label className="diagnostics-full-field diagnostics-image-field"><span><ImagePlus size={16}/> Optional image analysis</span><input type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={(event) => setImage(event.target.files?.[0])}/>{image && <small>{image.name} · {(image.size / 1024 / 1024).toFixed(2)} MB</small>}</label>
        <label className="diagnostics-checkbox"><input type="checkbox" checked={includeReportList} onChange={(event) => setIncludeReportList(event.target.checked)}/> Also time the live <code>GET /api/reports</code> endpoint</label>
        <div className="diagnostics-form-footer"><span>Runs analysis, embedding, a read-only Supabase check, matching, and image analysis if selected.</span><button className="button button-primary" disabled={running}><Play size={15}/>{running ? "Running diagnostics…" : "Run diagnostics"}</button></div>
      </form>

      <section className="diagnostics-results" aria-live="polite">
        <div className="panel diagnostics-run-summary">
          <div className="diagnostics-panel-heading"><div><div className="section-kicker">Live run</div><h2>{running ? "Request in progress" : totalDurationMs !== null ? "Run complete" : "Ready to test"}</h2></div><button type="button" className="button button-outline button-small" disabled={running || !steps.length && !error} onClick={clearResults}><RotateCcw size={14}/> Clear</button></div>
          <div className="diagnostics-summary-stats"><div><span>Analysis model</span><strong>{model || "—"}</strong></div><div><span>Timeout / attempts</span><strong>{timeoutMs / 1000}s · {attempts}</strong></div><div><span>Total elapsed</span><strong>{running && runStartedAt ? `${((clockNow - runStartedAt) / 1000).toFixed(1)}s` : totalDurationMs !== null ? `${(totalDurationMs / 1000).toFixed(2)}s` : "—"}</strong></div></div>
          {error && <div className="diagnostics-error"><XCircle size={16}/><span>{error}</span></div>}
          {totalDurationMs !== null && <div className="diagnostics-success"><CircleCheck size={16}/><span>Run finished. Review step timings and errors below.</span></div>}
        </div>

        <div className="panel diagnostics-step-panel">
          <div className="diagnostics-panel-heading"><div><div className="section-kicker">Execution trace</div><h2>What happened</h2></div><Clock3 size={18}/></div>
          {!steps.length && !running ? <div className="diagnostics-empty"><Server size={22}/><p>Start a run to see live status, duration, output, and any provider error for each step.</p></div> : <ol className="diagnostics-step-list">{steps.map((step) => <li key={step.name} className={`diagnostics-step diagnostics-${step.status}`}><div className="diagnostics-step-top"><div><span className="diagnostics-step-indicator">{step.status === "complete" ? <CircleCheck size={15}/> : step.status === "failed" ? <XCircle size={15}/> : step.status === "running" ? <span className="diagnostics-spinner"/> : <span>—</span>}</span><strong>{step.name}</strong></div><span>{step.status === "running" ? `${((clockNow - (step.clientStartedAt || clockNow)) / 1000).toFixed(1)}s · running` : step.durationMs !== undefined ? `${(step.durationMs / 1000).toFixed(2)}s` : step.status}</span></div>{step.error && <pre className="diagnostics-step-error">{step.error}</pre>}{step.reason && <p className="diagnostics-step-reason">{step.reason}</p>}{step.result !== undefined && <pre className="diagnostics-step-result">{JSON.stringify(step.result, null, 2)}</pre>}</li>)}</ol>}
        </div>
      </section>
    </div>

    <section className="panel diagnostics-console" aria-label="Copyable diagnostics console">
      <div className="diagnostics-console-heading">
        <div><div className="section-kicker">Run output</div><h2>Diagnostic console</h2></div>
        <button type="button" className="button button-outline button-small" onClick={() => void copyConsoleLogs()} disabled={!steps.length && !error}>
          {logsCopied ? <Check size={14}/> : <Copy size={14}/>}{logsCopied ? "Copied" : "Copy logs"}
        </button>
      </div>
      {copyError && <p className="diagnostics-console-copy-error">{copyError}</p>}
      <pre className="diagnostics-console-output" tabIndex={0}>{steps.length || error ? consoleText : "Run diagnostics to populate a timestamped, copyable log of each step, its duration, output, and errors."}</pre>
    </section>
  </div>;
}
