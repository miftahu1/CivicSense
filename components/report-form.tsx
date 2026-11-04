"use client";

import { Brand } from "@/components/brand";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Languages, LockKeyhole, MapPin, RotateCcw, Sparkles, UploadCloud, X } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { categories, type Category, type Priority, type Report } from "@/lib/types";
import { categoryLabel, tr } from "@/lib/i18n";

const buildings = ["Student Hostel", "Central Library", "Academic Building", "Commerce Building", "Dining Hall", "Administration Building", "Health Centre", "Science Building", "Campus Grounds", "Other"];

type LiveLocation = { latitude: number; longitude: number; accuracyMeters: number };

export function ReportForm() {
  const { locale } = useWorkspace();
  const [mode, setMode] = useState<"normal" | "image">("normal");
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null);
  return <>
    <div className="page-heading"><div><div className="section-kicker">{tr(locale, "Campus services · New report", "কেম্পাছ সেৱা · নতুন প্ৰতিবেদন")}</div><h1>{tr(locale, "What needs attention?", "কিহৰ প্ৰতি মনোযোগ দিব লাগে?")}</h1><p>{tr(locale, "Share what you noticed. A location and a few details help the right team respond.", "আপুনি লক্ষ্য কৰা কথাখিনি জনাওক। স্থান আৰু কেইটামান বিৱৰণে সঠিক দলক সঁহাৰি দিবলৈ সহায় কৰে।")}</p></div></div>
    <div className="report-mode-switch" role="group" aria-label={tr(locale, "Report creation mode", "প্ৰতিবেদন তৈয়াৰ কৰাৰ ধৰণ")}>
      <button type="button" className={mode === "normal" ? "active" : ""} onClick={() => setMode("normal")}><Languages size={15}/>{tr(locale, "Normal report", "সাধাৰণ প্ৰতিবেদন")}</button>
      <button type="button" className={mode === "image" ? "active" : ""} onClick={() => setMode("image")}><ImagePlus size={15}/>{tr(locale, "Image-first", "আলোকচিত্ৰৰ পৰা")}</button>
    </div>
    {mode === "normal"
      ? <NormalReportForm liveLocation={liveLocation} onLiveLocationChange={setLiveLocation}/>
      : <ImageFirstReportForm liveLocation={liveLocation} onLiveLocationChange={setLiveLocation}/>}
  </>;
}

function LiveLocationControl({ value, onChange, locale }: { value: LiveLocation | null; onChange: (location: LiveLocation | null) => void; locale: "en" | "as" }) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  function requestLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError(tr(locale, "Location is unavailable here. Use a supported browser on HTTPS or localhost.", "ইয়াত স্থানৰ সুবিধা উপলব্ধ নহয়। HTTPS বা localhost-ত সমৰ্থিত ব্ৰাউজাৰ ব্যৱহাৰ কৰক।"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude) || !Number.isFinite(coords.accuracy)) {
          setError(tr(locale, "Your browser returned an invalid location. You can still submit without a live pin.", "ব্ৰাউজাৰে ভুল স্থান ঘূৰাই দিলে। লাইভ পিন নোহোৱাকৈও দাখিল কৰিব পাৰে।"));
        } else {
          onChange({ latitude: coords.latitude, longitude: coords.longitude, accuracyMeters: coords.accuracy });
          setError("");
        }
        setLocating(false);
      },
      (failure) => {
        const message = failure.code === failure.PERMISSION_DENIED
          ? tr(locale, "Location permission was denied. Allow it in your browser settings to add a pin.", "স্থানৰ অনুমতি দিয়া নহ’ল। পিন যোগ কৰিবলৈ ব্ৰাউজাৰৰ ছেটিংছত অনুমতি দিয়ক।")
          : failure.code === failure.POSITION_UNAVAILABLE
            ? tr(locale, "Your current location is unavailable. Check your device’s location services and try again.", "আপোনাৰ বৰ্তমানৰ স্থান পোৱা নগ’ল। ডিভাইচৰ location services পৰীক্ষা কৰি পুনৰ চেষ্টা কৰক।")
            : tr(locale, "The location request timed out. Try again; you can still submit without a pin.", "স্থান বিচৰাৰ সময় শেষ হ’ল। পুনৰ চেষ্টা কৰক; পিন নোহোৱাকৈও দাখিল কৰিব পাৰে।");
        setError(message);
        setLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
  }

  return <div className="live-location-control">
    <div className="live-location-row">
      <button type="button" className="button button-outline button-small" onClick={requestLocation} disabled={locating}>
        <MapPin size={14}/>{locating
          ? tr(locale, "Getting your location…", "আপোনাৰ স্থান লোৱা হৈছে…")
          : value
            ? tr(locale, "Update live location", "লাইভ স্থান আপডেট কৰক")
            : tr(locale, "Use my current location", "মোৰ বৰ্তমানৰ স্থান ব্যৱহাৰ কৰক")}
      </button>
      {value && <span className="live-location-attached"><Check size={13}/>{tr(locale, "Pin added · ±" + Math.round(value.accuracyMeters) + " m accuracy", "পিন যোগ হ’ল · প্ৰায় ±" + Math.round(value.accuracyMeters) + " মিটাৰ সঠিকতা")}</span>}
      {value && <button type="button" className="live-location-remove" onClick={() => { onChange(null); setError(""); }}>{tr(locale, "Remove pin", "পিন আঁতৰাওক")}</button>}
    </div>
    <span className="field-hint">{tr(locale, "Optional. Your browser asks permission; this adds one location pin and does not track you.", "ইচ্ছা কৰিলে ব্যৱহাৰ কৰক। ব্ৰাউজাৰে অনুমতি বিচাৰিব; ইয়াত কেৱল এটা স্থান পিন যোগ হয়, আপোনাক অনুসৰণ কৰা নহয়।")}</span>
    {error && <span className="live-location-error" role="alert">{error}</span>}
  </div>;
}

function NormalReportForm({ liveLocation, onLiveLocationChange }: { liveLocation: LiveLocation | null; onLiveLocationChange: (location: LiveLocation | null) => void }) {
  const router = useRouter();
  const { submitReport, isDemo, locale } = useWorkspace();
  const fileInput = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<File | undefined>();
  const [preview, setPreview] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitStage, setSubmitStage] = useState(0);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [building, setBuilding] = useState("");
  const [area, setArea] = useState("");
  const [category, setCategory] = useState("");
  const [publicOptOut, setPublicOptOut] = useState(false);

  useEffect(() => {
    if (!busy) return;
    const stageTimer = window.setInterval(() => setSubmitStage((stage) => Math.min(stage + 1, 3)), 3_500);
    return () => window.clearInterval(stageTimer);
  }, [busy]);

  function takeFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError(tr(locale, "Choose an image file such as JPEG, PNG, or WebP.", "JPEG, PNG বা WebP-ৰ দৰে আলোকচিত্ৰ বাছক।")); return; }
    if (file.size > 15 * 1024 * 1024) { setError(tr(locale, "That image is larger than 15 MB. Choose a smaller file.", "আলোকচিত্ৰখন ১৫ MB-তকৈ ডাঙৰ। সৰু ফাইল বাছক।")); return; }
    setError(""); setImage(file); setPreview(URL.createObjectURL(file));
  }
  function removeFile() { setImage(undefined); setPreview(""); if (fileInput.current) fileInput.current.value = ""; }
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (text.trim().length < 10) { setError(tr(locale, "Add a little more detail so the campus team can understand the issue.", "কেম্পাছৰ দলে সমস্যাটো বুজিবলৈ অলপ বেছি বিৱৰণ দিয়ক।")); return; }
    if (!building && !liveLocation) { setError(tr(locale, "Choose a building or add a live location pin.", "ভৱন বাছক অথবা লাইভ স্থান পিন যোগ কৰক।")); return; }
    setSubmitStage(0);
    setBusy(true);
    try {
      const report = await submitReport({ originalText: text, building: building || (liveLocation ? "GPS location" : ""), area, category: category ? category as Report["category"] : undefined, publicOptOut, liveLocation: liveLocation || undefined, image });
      toast.success(tr(locale, "Your report has been saved.", "আপোনাৰ প্ৰতিবেদন সংৰক্ষণ কৰা হ’ল।")); router.push(`/app/reports/${report.id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr(locale, "We couldn't save your report. Please try again.", "প্ৰতিবেদন সংৰক্ষণ কৰিব পৰা নগ’ল। পুনৰ চেষ্টা কৰক।")); }
    finally { setBusy(false); }
  }

  return <>{busy && <div className="submission-screen" role="status" aria-live="polite" aria-atomic="true"><div className="submission-card"><div className="submission-mark"><Brand light/></div><div className="section-kicker">{tr(locale, "CivicSense is at work", "CivicSense-এ কাম কৰি আছে")}</div><h2>{[tr(locale,"Sending your report","আপোনাৰ প্ৰতিবেদন পঠিওৱা হৈছে"),tr(locale,"Saving it to your campus workspace","কেম্পাছ ৱৰ্কস্পেচত সংৰক্ষণ কৰা হৈছে"),tr(locale,"Securing any photo you attached","সংলগ্ন আলোকচিত্ৰ সুৰক্ষিত কৰা হৈছে"),tr(locale,"Finishing your submission","দাখিল সম্পূৰ্ণ কৰা হৈছে")][submitStage]}</h2><p>{tr(locale,"Your report and photo are being sent securely. We’ll open the saved report next; bilingual analysis will continue on its report page.","আপোনাৰ প্ৰতিবেদন আৰু আলোকচিত্ৰ সুৰক্ষিতভাৱে পঠিওৱা হৈছে। সংৰক্ষিত প্ৰতিবেদনটো পিছত খোলা হ’ব; দ্বিভাষিক বিশ্লেষণ প্ৰতিবেদনৰ পৃষ্ঠাত চলি থাকিব।")}</p><div className="submission-progress" aria-hidden="true"><i/></div><ol className="submission-steps">{[tr(locale,"Send","পঠিয়াওক"),tr(locale,"Save","সংৰক্ষণ"),tr(locale,"Photo","আলোকচিত্ৰ"),tr(locale,"Open","খোলক")].map((label,index)=><li key={label} className={index <= submitStage ? "active" : ""}><span>{index < submitStage ? "✓" : index + 1}</span>{label}</li>)}</ol><span className="submission-footnote"><RotateCcw size={13} className="spin-icon"/>{tr(locale,"This can take a short moment. Please keep this page open.","অলপ সময় লাগিব পাৰে। অনুগ্ৰহ কৰি এই পৃষ্ঠা খোলা ৰাখক।")}</span></div></div>}<form onSubmit={onSubmit} className="form-layout" noValidate><div className="panel form-panel">
    <div className="form-section-title"><span className="section-number">1</span><div><h2>{tr(locale, "Describe the issue", "সমস্যাটোৰ বিৱৰণ দিয়ক")}</h2><p>{tr(locale, "Write in English, Assamese, or Romanised Assamese. CivicSense identifies the source language automatically and keeps your original wording.", "ইংৰাজী, অসমীয়া বা ৰোমানাইজড অসমীয়াত লিখক। CivicSense-এ উৎস ভাষা নিজে চিনাক্ত কৰিব আৰু আপোনাৰ মূল কথাখিনি অক্ষত ৰাখিব।")}</p></div></div>
    <div className="field"><label htmlFor="report-text">{tr(locale, "What happened, and where?", "কি ঘটিল, আৰু ক’ত?")}</label><textarea id="report-text" value={text} onChange={(event) => setText(event.target.value)} maxLength={5000} placeholder={tr(locale,"Describe the issue in English, Assamese, or Romanised Assamese…","ইংৰাজী, অসমীয়া বা ৰোমানাইজড অসমীয়াত সমস্যাটোৰ বিৱৰণ দিয়ক…")} required/></div><div className="char-count">{text.length.toLocaleString(locale === "as" ? "as-IN" : "en-IN")} / 5,000</div>
    <div className="field" style={{marginTop:20}}><label>{tr(locale,"Photograph","আলোকচিত্ৰ")} <span style={{fontWeight:400,color:"#8c928a"}}>· {tr(locale,"optional","ইচ্ছা কৰিলে")}</span></label><div className={`dropzone ${dragging?"dragging":""}`} onDragEnter={(event) => {event.preventDefault();setDragging(true);}} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => {event.preventDefault();setDragging(false);takeFile(event.dataTransfer.files[0]);}}><input ref={fileInput} aria-label={tr(locale,"Choose a photograph","আলোকচিত্ৰ বাছক")} type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" onChange={(event) => takeFile(event.target.files?.[0])}/><div><UploadCloud size={20} className="dropzone-icon"/><strong>{tr(locale,"Drop a photo here, or tap to choose","আলোকচিত্ৰ ইয়ালৈ টানি আনক বা বাছিবলৈ টিপক")}</strong><span>{tr(locale,"JPEG, PNG, WebP or HEIC · up to 15 MB · photos stay private","JPEG, PNG, WebP বা HEIC · সৰ্বাধিক ১৫ MB · আলোকচিত্ৰ ব্যক্তিগতভাৱে সংৰক্ষিত হয়")}</span></div></div>{preview && <div className="image-preview"><Image src={preview} alt={tr(locale,"Preview of the selected campus issue","বাছনি কৰা কেম্পাছ সমস্যাৰ আলোকচিত্ৰৰ পূৰ্বদৃশ্য")} width={440} height={330} unoptimized/><button type="button" className="remove-image" aria-label={tr(locale,"Remove photo","আলোকচিত্ৰ আঁতৰাওক")} onClick={removeFile}><X size={14}/></button></div>}</div>
    <div className="form-section-title" style={{marginTop:30}}><span className="section-number">2</span><div><h2>{tr(locale,"Place it on the map","স্থান বাছনি কৰক")}</h2><p>{tr(locale,"Choose a building, or add a live pin instead. A room, floor, or landmark helps the team find it.","ভৱন বাছক অথবা লাইভ পিন যোগ কৰক। কোঠা, মহলা বা চিনাকি স্থানে দলক স্থান বিচাৰি পোৱাত সহায় কৰে।")}</p></div></div>
    <div className="location-grid"><div className="field"><label htmlFor="building">{tr(locale,"Building or campus area","ভৱন বা কেম্পাছৰ ঠাই")}</label><select id="building" value={building} onChange={(event) => setBuilding(event.target.value)} required={!liveLocation}><option value="">{tr(locale,"Choose a location","স্থান বাছক")}</option>{buildings.map((item) => <option key={item}>{item}</option>)}</select><span className="field-hint">{tr(locale,liveLocation ? "Optional because your live pin is attached." : "Choose a building, or add a live location pin below.",liveLocation ? "লাইভ পিন যোগ কৰা হৈছে, সেয়ে এইটো বাধ্যতামূলক নহয়।" : "ভৱন বাছক অথবা তলত লাইভ স্থান পিন যোগ কৰক।")}</span></div><div className="field"><label htmlFor="area">{tr(locale,"Room, floor, or landmark","কোঠা, মহলা বা চিনাকি স্থান")}</label><input id="area" value={area} onChange={(event) => setArea(event.target.value)} maxLength={120} placeholder={tr(locale,"e.g. Third floor · north wing","যেনে: তৃতীয় মহলা · উত্তৰ অংশ")}/></div></div>
    <LiveLocationControl value={liveLocation} onChange={onLiveLocationChange} locale={locale}/>
    <div className="form-section-title" style={{marginTop:8}}><span className="section-number">3</span><div><h2>{tr(locale,"Help us route it","সঠিক দললৈ পঠিয়াবলৈ সহায় কৰক")}</h2><p>{tr(locale,"Pick a category, or let the AI suggest one from your report.","শ্ৰেণী বাছক, অথবা প্ৰতিবেদনৰ পৰা এআইক পৰামৰ্শ দিবলৈ দিয়ক।")}</p></div></div>
    <div className="field"><label htmlFor="category">{tr(locale,"Issue category","সমস্যাৰ শ্ৰেণী")}</label><select id="category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">{tr(locale,"Suggest a category automatically","শ্ৰেণী স্বয়ংক্ৰিয়ভাৱে পৰামৰ্শ দিয়ক")}</option>{categories.map((item) => <option key={item} value={item}>{categoryLabel(item, locale)}</option>)}</select><span className="field-hint"><span className="brand-mark" aria-hidden="true"></span> {isDemo ? tr(locale,"Live analysis is available when Gemini is configured.","Gemini সংযোগ কৰিলে প্ৰকৃত এআই বিশ্লেষণ উপলব্ধ হ’ব।") : tr(locale,"CivicSense will compare the report and photograph to suggest a category and priority.","CivicSense-এ প্ৰতিবেদন আৰু আলোকচিত্ৰ পৰ্যালোচনা কৰি শ্ৰেণী আৰু অগ্ৰাধিকাৰ পৰামৰ্শ দিব।")}</span></div>
    <label className="public-optout-control"><input type="checkbox" checked={publicOptOut} onChange={(event) => setPublicOptOut(event.target.checked)}/><span><strong>{tr(locale,"Do not show this report publicly","এই প্ৰতিবেদন ৰাজহুৱাভাৱে নেদেখুৱাব")}</strong><small>{tr(locale,"If unchecked, its summary, category, location and status may appear on the public issues page when an administrator enables it. Your original wording, name and photo stay private.","চিহ্নিত নকৰিলে, প্ৰশাসকে ৰাজহুৱা সমস্যা পৃষ্ঠা চালু কৰিলে ইয়াৰ সাৰাংশ, শ্ৰেণী, স্থান আৰু স্থিতি দেখা যাব পাৰে। মূল বিৱৰণ, নাম আৰু আলোকচিত্ৰ ব্যক্তিগত থাকিব।")}</small></span></label>
    {error && <p className="error-text" role="alert">{error}</p>}
    <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",marginTop:9,paddingTop:17,borderTop:"1px solid #e6e4dc"}}><span className="field-hint">{busy ? <><RotateCcw size={12} className="spin-icon"/> {tr(locale,"Saving and preparing the report…","প্ৰতিবেদন সংৰক্ষণ আৰু প্ৰস্তুত কৰা হৈছে…")}</> : tr(locale,"You can review the report after it is submitted.","দাখিলৰ পিছত প্ৰতিবেদন পৰ্যালোচনা কৰিব পাৰিব।")}</span><button className="button button-terracotta" disabled={busy}>{busy ? tr(locale,"Submitting…","দাখিল কৰা হৈছে…") : <>{tr(locale,"Submit report","প্ৰতিবেদন দাখিল কৰক")} <ArrowRight size={14}/></>}</button></div>
  </div><aside className="form-aside"><section className="aside-card"><div className="section-kicker">{tr(locale,"A useful report","এটা সহায়ক প্ৰতিবেদন")}</div><h3>{tr(locale,"Small details make a difference.","সৰু বিৱৰণেও সহায় কৰে।")}</h3><p>{tr(locale,"Give the campus team enough context to find the issue and understand what needs to happen next.","কেম্পাছৰ দলক সমস্যাটো বিচাৰি আৰু পৰৱৰ্তী পদক্ষেপ বুজিবলৈ প্ৰয়োজনীয় তথ্য দিয়ক।")}</p><div className="aside-checklist"><div className="aside-check"><Check size={14}/>{tr(locale,"Describe what you can see or hear","আপুনি দেখা বা শুনা কথাখিনি লিখক")}</div><div className="aside-check"><MapPin size={14}/>{tr(locale,"Name the building and nearby location","ভৱন আৰু ওচৰৰ স্থান উল্লেখ কৰক")}</div><div className="aside-check"><ImagePlus size={14}/>{tr(locale,"Add a photo if it helps explain the issue","সহায় হ’লে আলোকচিত্ৰ যোগ কৰক")}</div><div className="aside-check assamese" lang="as"><Languages size={14}/>অসমীয়া, ৰোমানাইজড অসমীয়া বা ইংৰাজীত লিখিব পাৰে</div></div></section><div className="privacy-note"><LockKeyhole size={15}/><span>{tr(locale,"Only you and authorised campus staff can see your report and its attachments. Your original wording stays unchanged.","আপুনি আৰু অনুমোদিত কেম্পাছ কৰ্মচাৰীয়েহে প্ৰতিবেদন আৰু আলোকচিত্ৰ চাব পাৰে। আপোনাৰ মূল কথাখিনি সলনি নহয়।")}</span></div><section className="aside-card" style={{background:"#f0eee5"}}><h3>{tr(locale,"What happens next?","ইয়াৰ পিছত কি হ’ব?")}</h3><p>{tr(locale,"Your report is saved first. The analysis then prepares a bilingual summary and suggests related reports. A campus team reviews those suggestions and confirms any grouping.","প্ৰথমে আপোনাৰ প্ৰতিবেদন সংৰক্ষণ কৰা হয়। তাৰ পিছত বিশ্লেষণে দুয়োটা ভাষাত সাৰাংশ তৈয়াৰ কৰি সম্পৰ্কিত প্ৰতিবেদন পৰামৰ্শ দিয়ে। কেম্পাছৰ দলে পৰামৰ্শ পৰ্যালোচনা কৰি একেলগ কৰা নিশ্চিত কৰে।")}</p></section></aside></form></>;
}

type ImageDraftResponse = {
  token: string;
  description: string;
  category: Category;
  priority: Priority;
  priorityExplanation: string;
};

function ImageFirstReportForm({ liveLocation, onLiveLocationChange }: { liveLocation: LiveLocation | null; onLiveLocationChange: (location: LiveLocation | null) => void }) {
  const router = useRouter();
  const { submitReport, locale } = useWorkspace();
  const fileInput = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<File>();
  const [preview, setPreview] = useState("");
  const [building, setBuilding] = useState("");
  const [area, setArea] = useState("");
  const [draft, setDraft] = useState<ImageDraftResponse>();
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [publicOptOut, setPublicOptOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => { if (!busy) return; const timer = window.setInterval(() => setStage((current) => Math.min(3, current + 1)), 5_000); return () => window.clearInterval(timer); }, [busy]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function chooseImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError(tr(locale, "Choose an image file such as JPEG, PNG, or WebP.", "JPEG, PNG বা WebP-ৰ দৰে আলোকচিত্ৰ বাছক।")); return; }
    if (file.size > 15 * 1024 * 1024) { setError(tr(locale, "That image is larger than 15 MB. Choose a smaller file.", "আলোকচিত্ৰখন ১৫ MB-তকৈ ডাঙৰ। সৰু ফাইল বাছক।")); return; }
    if (preview) URL.revokeObjectURL(preview);
    setError(""); setDraft(undefined); setImage(file); setPreview(URL.createObjectURL(file));
  }
  function removeImage() { if (preview) URL.revokeObjectURL(preview); setImage(undefined); setPreview(""); setDraft(undefined); if (fileInput.current) fileInput.current.value = ""; }

  async function analyzePhoto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!image) { setError(tr(locale, "Choose a photo of the issue to continue.", "আগবাঢ়িবলৈ সমস্যাটোৰ আলোকচিত্ৰ বাছক।")); return; }
    if (!building && !liveLocation) { setError(tr(locale, "Choose a building or add a live location pin.", "ভৱন বাছক অথবা লাইভ স্থান পিন যোগ কৰক।")); return; }
    setBusy(true); setStage(0);
    try {
      const effectiveBuilding = building || (liveLocation ? "GPS location" : "");
      const form = new FormData(); form.set("image", image); form.set("building", effectiveBuilding); form.set("area", area);
      if (liveLocation) { form.set("latitude", String(liveLocation.latitude)); form.set("longitude", String(liveLocation.longitude)); }
      const response = await fetch("/api/reports/image-draft", { method: "POST", body: form });
      const body = await response.json() as ImageDraftResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || tr(locale, "We couldn't analyze this photo. Please try again.", "আলোকচিত্ৰখন বিশ্লেষণ কৰিব পৰা নগ’ল। পুনৰ চেষ্টা কৰক।"));
      setDraft(body); setDescription(body.description); setCategory(body.category);
      toast.success(tr(locale, "Image analysis is ready. Review the suggested report.", "আলোকচিত্ৰৰ বিশ্লেষণ সম্পূৰ্ণ। পৰামৰ্শ দিয়া প্ৰতিবেদন পৰ্যালোচনা কৰক।"));
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr(locale, "We couldn't analyze this photo. Please try again.", "আলোকচিত্ৰখন বিশ্লেষণ কৰিব পৰা নগ’ল। পুনৰ চেষ্টা কৰক।")); }
    finally { setBusy(false); }
  }

  async function confirmReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!draft || !image) { setError(tr(locale, "Analyze the photo again before submitting.", "দাখিল কৰাৰ আগতে আলোকচিত্ৰখন পুনৰ বিশ্লেষণ কৰক।")); return; }
    if (!building && !liveLocation) { setError(tr(locale, "Choose a building or add a live location pin.", "ভৱন বাছক অথবা লাইভ স্থান পিন যোগ কৰক।")); return; }
    if (description.trim().length < 10) { setError(tr(locale, "Add a little more detail so the campus team can understand the issue.", "কেম্পাছৰ দলে সমস্যাটো বুজিবলৈ অলপ বেছি বিৱৰণ দিয়ক।")); return; }
    setBusy(true); setStage(0);
    try {
      const report = await submitReport({ originalText: description.trim(), building: building || (liveLocation ? "GPS location" : ""), area, category: category || draft.category, publicOptOut, liveLocation: liveLocation || undefined, image, imageDraftToken: draft.token });
      toast.success(tr(locale, "Your report has been submitted.", "আপোনাৰ প্ৰতিবেদন দাখিল কৰা হ’ল।")); router.push(`/app/reports/${report.id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr(locale, "We couldn't save your report. Please try again.", "প্ৰতিবেদন সংৰক্ষণ কৰিব পৰা নগ’ল। পুনৰ চেষ্টা কৰক।")); }
    finally { setBusy(false); }
  }

  const changed = Boolean(draft && (description.trim() !== draft.description || category !== draft.category));
  const busyHeading = draft
    ? stage < 1 ? tr(locale, "Saving your confirmed report", "নিশ্চিত প্ৰতিবেদন সংৰক্ষণ কৰা হৈছে") : stage < 2 ? tr(locale, "Attaching your photo securely", "আলোকচিত্ৰ সুৰক্ষিতভাৱে সংলগ্ন কৰা হৈছে") : tr(locale, "Finding related campus issues", "সম্পৰ্কিত কেম্পাছ সমস্যা বিচৰা হৈছে")
    : stage < 1 ? tr(locale, "Reading the photo", "আলোকচিত্ৰ পৰীক্ষা কৰা হৈছে") : stage < 2 ? tr(locale, "Writing a clear description", "স্পষ্ট বিৱৰণ লিখা হৈছে") : stage < 3 ? tr(locale, "Suggesting category and priority", "শ্ৰেণী আৰু অগ্ৰাধিকাৰ পৰামৰ্শ দিয়া হৈছে") : tr(locale, "Preparing your review", "পৰ্যালোচনাৰ বাবে প্ৰস্তুত কৰা হৈছে");

  return <>{busy && <div className="submission-screen" role="status" aria-live="polite"><div className="submission-card"><div className="submission-mark"><Brand light/></div><div className="section-kicker">{tr(locale, "CivicSense is at work", "CivicSense-এ কাম কৰি আছে")}</div><h2>{busyHeading}</h2><p>{draft ? tr(locale, "Your confirmed report is being saved. Only edits to the generated description or category need a new analysis.", "নিশ্চিত কৰা প্ৰতিবেদন সংৰক্ষণ কৰা হৈছে। তৈয়াৰ কৰা বিৱৰণ বা শ্ৰেণী সলনি কৰিলেহে পুনৰ বিশ্লেষণ হ’ব।") : tr(locale, "We’re looking at the photo and preparing a report for you to review. Nothing is submitted yet.", "আলোকচিত্ৰ চাই আপোনাৰ পৰ্যালোচনাৰ বাবে প্ৰতিবেদন তৈয়াৰ কৰা হৈছে। এতিয়ালৈকে একো দাখিল হোৱা নাই।")}</p><div className="submission-progress" aria-hidden="true"><i/></div><ol className="submission-steps">{[tr(locale,"Photo","আলোকচিত্ৰ"),tr(locale,"Understand","বুজা"),tr(locale,"Suggest","পৰামৰ্শ"),tr(locale,"Review","পৰ্যালোচনা")].map((label,index)=><li key={label} className={index <= stage ? "active" : ""}><span>{index < stage ? "✓" : index + 1}</span>{label}</li>)}</ol><span className="submission-footnote"><RotateCcw size={13} className="spin-icon"/>{tr(locale,"This can take a short moment. Please keep this page open.","অলপ সময় লাগিব পাৰে। অনুগ্ৰহ কৰি এই পৃষ্ঠা খোলা ৰাখক।")}</span></div></div>}
    {!draft ? <form className="form-layout image-first-layout" onSubmit={analyzePhoto} noValidate><div className="panel form-panel image-first-panel">
      <div className="form-section-title"><span className="section-number">1</span><div><h2>{tr(locale,"Add a photo","আলোকচিত্ৰ যোগ কৰক")}</h2><p>{tr(locale,"CivicSense will describe the visible issue and suggest a category and priority. You can review everything before submitting.","CivicSense-এ দেখা সমস্যাৰ বিৱৰণ দি শ্ৰেণী আৰু অগ্ৰাধিকাৰ পৰামৰ্শ দিব। দাখিলৰ আগতে সকলো পৰ্যালোচনা কৰিব পাৰিব।")}</p></div></div>
      <div className="field"><label>{tr(locale,"Photo of the issue","সমস্যাটোৰ আলোকচিত্ৰ")}</label><div className="dropzone"><input ref={fileInput} aria-label={tr(locale,"Choose a photograph","আলোকচিত্ৰ বাছক")} type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" onChange={(event) => chooseImage(event.target.files?.[0])}/><div><UploadCloud size={20} className="dropzone-icon"/><strong>{tr(locale,"Drop a photo here, or tap to choose","আলোকচিত্ৰ ইয়ালৈ টানি আনক বা বাছিবলৈ টিপক")}</strong><span>{tr(locale,"JPEG, PNG, WebP or HEIC · up to 15 MB","JPEG, PNG, WebP বা HEIC · সৰ্বাধিক ১৫ MB")}</span></div></div>{preview && <div className="image-preview"><Image src={preview} alt={tr(locale,"Selected issue photo","বাছনি কৰা সমস্যাৰ আলোকচিত্ৰ")} width={600} height={400} unoptimized/><button type="button" className="remove-image" aria-label={tr(locale,"Remove photo","আলোকচিত্ৰ আঁতৰাওক")} onClick={removeImage}><X size={14}/></button></div>}</div>
      <div className="form-section-title" style={{marginTop:27}}><span className="section-number">2</span><div><h2>{tr(locale,"Where is it?","ই ক’ত হৈছে?")}</h2><p>{tr(locale,"A precise location helps the campus team find the issue.","সঠিক স্থানে কেম্পাছৰ দলক সমস্যাটো বিচাৰি উলিয়াবলৈ সহায় কৰে।")}</p></div></div>
      <div className="location-grid"><div className="field"><label htmlFor="image-building">{tr(locale,"Building or campus area","ভৱন বা কেম্পাছৰ ঠাই")}</label><select id="image-building" value={building} onChange={(event) => setBuilding(event.target.value)} required={!liveLocation}><option value="">{tr(locale,"Choose a location","স্থান বাছক")}</option>{buildings.map((item) => <option key={item}>{item}</option>)}</select><span className="field-hint">{tr(locale,liveLocation ? "Optional because your live pin is attached." : "Choose a building, or add a live location pin below.",liveLocation ? "লাইভ পিন যোগ কৰা হৈছে, সেয়ে এইটো বাধ্যতামূলক নহয়।" : "ভৱন বাছক অথবা তলত লাইভ স্থান পিন যোগ কৰক।")}</span></div><div className="field"><label htmlFor="image-area">{tr(locale,"Room, floor, or landmark","কোঠা, মহলা বা চিনাকি স্থান")}</label><input id="image-area" value={area} onChange={(event) => setArea(event.target.value)} maxLength={120} placeholder={tr(locale,"e.g. Third floor · north wing","যেনে: তৃতীয় মহলা · উত্তৰ অংশ")}/></div></div>
      <LiveLocationControl value={liveLocation} onChange={onLiveLocationChange} locale={locale}/>
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="image-first-footer"><span className="field-hint"><LockKeyhole size={13}/>{tr(locale,"Your photo stays private and is only submitted after your confirmation.","আপোনাৰ আলোকচিত্ৰ ব্যক্তিগত থাকে আৰু নিশ্চিত কৰাৰ পিছতহে দাখিল হয়।")}</span><button className="button button-terracotta" disabled={busy}>{tr(locale,"Analyze photo", "আলোকচিত্ৰ বিশ্লেষণ কৰক")} <Sparkles size={14}/></button></div>
    </div><aside className="form-aside"><section className="aside-card"><div className="section-kicker">{tr(locale,"Image-first report","আলোকচিত্ৰৰ পৰা প্ৰতিবেদন")}</div><h3>{tr(locale,"Start with what you see.","আপুনি যি দেখিছে তাৰ পৰাই আৰম্ভ কৰক।")}</h3><p>{tr(locale,"AI drafts a clear description and recommends a category and priority. You choose what to submit.","AI-য়ে স্পষ্ট বিৱৰণ লিখি শ্ৰেণী আৰু অগ্ৰাধিকাৰ পৰামৰ্শ দিয়ে। কি দাখিল কৰিব সেয়া আপুনিহে বাছিব।")}</p><div className="aside-checklist"><div className="aside-check"><Check size={14}/>{tr(locale,"Review and edit the description","বিৱৰণ পৰ্যালোচনা আৰু সম্পাদনা কৰক")}</div><div className="aside-check"><Check size={14}/>{tr(locale,"Change the suggested category","পৰামৰ্শ দিয়া শ্ৰেণী সলনি কৰক")}</div><div className="aside-check"><Check size={14}/>{tr(locale,"Nothing is submitted before confirmation","নিশ্চিত কৰাৰ আগতে একো দাখিল নহয়")}</div></div></section></aside></form>
      : <form className="form-layout image-first-layout" onSubmit={confirmReport} noValidate><div className="panel form-panel image-first-panel">
      <div className="image-review-header"><div><div className="section-kicker"><Sparkles size={13}/>{tr(locale,"AI image suggestions ready","AI-ৰ আলোকচিত্ৰৰ পৰামৰ্শ প্ৰস্তুত")}</div><h2>{tr(locale,"Review before you submit","দাখিলৰ আগতে পৰ্যালোচনা কৰক")}</h2><p>{tr(locale,"The photo has been analyzed. Bilingual summaries are prepared after you confirm submission.","আলোকচিত্ৰ বিশ্লেষণ কৰা হৈছে। দাখিল নিশ্চিত কৰাৰ পিছতহে দ্বিভাষিক সাৰাংশ প্ৰস্তুত হ’ব।")}</p></div><button type="button" className="button button-outline button-small" disabled={busy} onClick={() => setDraft(undefined)}><ArrowLeft size={13}/>{tr(locale,"Change photo or location","আলোকচিত্ৰ বা স্থান সলনি কৰক")}</button></div>
        <div className="image-review-summary"><div className="image-review-photo"><Image src={preview} alt={tr(locale,"Photo being submitted","দাখিল কৰিবলগীয়া আলোকচিত্ৰ")} width={500} height={340} unoptimized/></div><div className="image-review-ai"><span className="section-kicker">{tr(locale,"Suggested priority","পৰামৰ্শ দিয়া অগ্ৰাধিকাৰ")}</span><strong className={`image-priority image-priority-${draft.priority.toLowerCase()}`}>{draft.priority}</strong><p>{draft.priorityExplanation}</p><small>{tr(locale,"Image triage only · no translation yet", "কেৱল আলোকচিত্ৰৰ মূল্যায়ন · এতিয়ালৈ অনুবাদ হোৱা নাই")}</small></div></div>
        <div className="field image-review-field"><label htmlFor="image-description">{tr(locale,"Issue description","সমস্যাৰ বিৱৰণ")}</label><textarea id="image-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} required/><span className="field-hint">{tr(locale,"AI-generated from visible details. Edit it to add context the photo cannot show.","দেখা তথ্যৰ পৰা AI-য়ে তৈয়াৰ কৰিছে। আলোকচিত্ৰত নেদেখা প্ৰসংগ যোগ কৰিবলৈ সম্পাদনা কৰক।")}</span></div>
        <div className="field image-review-field"><label htmlFor="image-category">{tr(locale,"Suggested category","পৰামৰ্শ দিয়া শ্ৰেণী")}</label><select id="image-category" value={category} onChange={(event) => setCategory(event.target.value as Category)}>{categories.map((item) => <option key={item} value={item}>{categoryLabel(item, locale)}</option>)}</select></div>
        <div className="image-review-location"><MapPin size={14}/><span><strong>{building || (liveLocation ? tr(locale, "GPS location", "GPS স্থান") : "")}</strong>{area ? ` · ${area}` : ""}</span></div>
        <LiveLocationControl value={liveLocation} onChange={onLiveLocationChange} locale={locale}/>
        <label className="public-optout-control"><input type="checkbox" checked={publicOptOut} onChange={(event) => setPublicOptOut(event.target.checked)}/><span><strong>{tr(locale,"Do not show this report publicly","এই প্ৰতিবেদন ৰাজহুৱাভাৱে নেদেখুৱাব")}</strong><small>{tr(locale,"If unchecked, its summary, category, location and status may appear on the public issues page when enabled. Your original wording and photo stay private.","চিহ্নিত নকৰিলে, প্ৰশাসকে ৰাজহুৱা সমস্যা পৃষ্ঠা চালু কৰিলে ইয়াৰ সাৰাংশ, শ্ৰেণী, স্থান আৰু স্থিতি দেখা যাব পাৰে। মূল বিৱৰণ আৰু আলোকচিত্ৰ ব্যক্তিগত থাকিব।")}</small></span></label>
        {changed && <div className="image-edit-analysis-note"><Sparkles size={14}/>{tr(locale,"You changed the AI draft. CivicSense will analyze your final description and category before saving.","AI খচৰাত সলনি কৰিছে। সংৰক্ষণৰ আগতে CivicSense-এ চূড়ান্ত বিৱৰণ আৰু শ্ৰেণী বিশ্লেষণ কৰিব।")}</div>}
        {!changed && <div className="image-edit-analysis-note image-edit-analysis-note-ready"><Check size={14}/>{tr(locale,"No edits detected. We’ll reuse this analysis and won’t run report analysis again.","কোনো সলনি হোৱা নাই। এই বিশ্লেষণ পুনৰ ব্যৱহাৰ হ’ব আৰু প্ৰতিবেদন বিশ্লেষণ আকৌ নচলিব।")}</div>}
        {error && <p className="error-text" role="alert">{error}</p>}
        <div className="image-first-footer"><button type="button" className="button button-outline" disabled={busy} onClick={() => setDraft(undefined)}>{tr(locale,"Back","উভতি যাওক")}</button><button className="button button-terracotta" disabled={busy}>{busy ? tr(locale,"Submitting…","দাখিল কৰা হৈছে…") : <>{tr(locale,"Confirm and submit","নিশ্চিত কৰি দাখিল কৰক")} <ArrowRight size={14}/></>}</button></div>
      </div><aside className="form-aside"><section className="aside-card"><div className="section-kicker">{tr(locale,"AI image triage","AI আলোকচিত্ৰ মূল্যায়ন")}</div><h3>{categoryLabel(category || draft.category, locale)}</h3><p>{draft.priorityExplanation}</p><div className="aside-checklist"><div className="aside-check"><Check size={14}/>{categoryLabel(category || draft.category, locale)}</div><div className="aside-check"><Sparkles size={14}/>{draft.priority} {tr(locale,"suggested priority","পৰামৰ্শ দিয়া অগ্ৰাধিকাৰ")}</div><div className="aside-check"><MapPin size={14}/>{building || (liveLocation ? tr(locale, "GPS location", "GPS স্থান") : "")}{area ? ` · ${area}` : ""}</div></div></section><div className="privacy-note"><LockKeyhole size={15}/><span>{tr(locale,"Your name, image, and original image description are not shown publicly.","আপোনাৰ নাম, আলোকচিত্ৰ আৰু মূল বিৱৰণ ৰাজহুৱাভাৱে দেখুওৱা নহ’ব।")}</span></div></aside></form>}
  </>;
}
