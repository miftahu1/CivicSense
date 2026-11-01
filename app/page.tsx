"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowRight, Building2, Check, ChevronLeft, ChevronRight, CircleCheck, Droplet, FilePlus2, Flag, GitMerge, Globe2, Languages, Layers3, Lightbulb, Pencil, Recycle, ShieldCheck, Sparkles, TriangleAlert, UserRound, UsersRound, Zap } from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageToggle } from "@/components/language-toggle";
import { useWorkspace } from "@/components/workspace-provider";
import { tr } from "@/lib/i18n";
import campusHero from "@/src/assets/campus-hero.png";
import dustbin from "@/src/assets/dustbin.png";
import pothole from "@/src/assets/pothole.png";
import streetlight from "@/src/assets/streetlight.png";
import waterIssue from "@/src/assets/water-issue.webp";

type ExampleKey = "as" | "rom" | "en";

const examples: Record<ExampleKey, {
  tab: string;
  source: string;
  language: string;
  text: string;
  score: string;
  englishSummary: string;
  assameseSummary: string;
}> = {
  as: {
    tab: "অসমীয়া",
    source: "Assamese · native script",
    language: "Assamese",
    text: "আমাৰ হোষ্টেলৰ তৃতীয় মহলাত দুদিন ধৰি পানী নাই। বাথৰুমৰ পাইপলাইনৰ পৰা পানী অহা নাই আৰু ছাত্ৰ-ছাত্ৰীৰ বহুত অসুবিধা হৈছে।",
    score: "96.2%",
    englishSummary: "No water has reached the hostel’s third floor for two days.",
    assameseSummary: "হোষ্টেলৰ তৃতীয় মহলাত দুদিন ধৰি পানীৰ যোগান বন্ধ হৈ আছে।",
  },
  rom: {
    tab: "Romanised",
    source: "Romanised Assamese",
    language: "Romanised Assamese",
    text: "Hostel r third floor ot dudin dhori pani nai. Please help jaldi solve kori diok.",
    score: "94.2%",
    englishSummary: "A resident reports a two day water outage on the hostel’s third floor.",
    assameseSummary: "হোষ্টেলৰ তৃতীয় মহলাত দুদিন ধৰি পানী নাই বুলি এজন আৱাসীয়ে জনাইছে।",
  },
  en: {
    tab: "English",
    source: "English · original wording",
    language: "English",
    text: "There has been no water supply on the third floor of the hostel for two days. The washroom taps are dry.",
    score: "97.5%",
    englishSummary: "No water is reaching the hostel’s third floor, including the washrooms.",
    assameseSummary: "হোষ্টেলৰ তৃতীয় মহলাৰ বাথৰুমসমূহলৈকে পানী যোগান বন্ধ হৈ আছে।",
  },
};

const issueCards = [
  { id: "water", label: "Water supply", assamese: "পানী যোগান", alt: "Water tap with a supply issue", image: waterIssue, Icon: Droplet },
  { id: "cleanliness", label: "Cleanliness", assamese: "পৰিষ্কাৰ-পৰিচ্ছন্নতা", alt: "Campus recycling bins", image: dustbin, Icon: Recycle },
  { id: "infrastructure", label: "Infrastructure", assamese: "আন্তঃগাঁথনি", alt: "Pothole on a campus road", image: pothole, Icon: TriangleAlert },
  { id: "lighting", label: "Lighting", assamese: "পোহৰ", alt: "Streetlight at night", image: streetlight, Icon: Lightbulb },
];

function tiltDashboard(event: ReactPointerEvent<HTMLDivElement>) {
  if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const { clientX, clientY, currentTarget } = event;
  currentTarget.querySelectorAll<HTMLElement>(".home-glass").forEach((card) => {
    const bounds = card.getBoundingClientRect();
    const isOverCard = clientX >= bounds.left && clientX <= bounds.right && clientY >= bounds.top && clientY <= bounds.bottom;
    if (!isOverCard) {
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
      return;
    }
    const x = (clientX - bounds.left) / bounds.width - 0.5;
    const y = (clientY - bounds.top) / bounds.height - 0.5;
    card.style.setProperty("--tilt-x", `${-y * 5}deg`);
    card.style.setProperty("--tilt-y", `${x * 6}deg`);
  });
}

function resetDashboardTilt(event: ReactPointerEvent<HTMLDivElement>) {
  event.currentTarget.querySelectorAll<HTMLElement>(".home-glass").forEach((card) => {
    card.style.setProperty("--tilt-x", "0deg");
    card.style.setProperty("--tilt-y", "0deg");
  });
}

export default function LandingPage() {
  const { locale, isAuthenticated, user } = useWorkspace();
  const [exampleKey, setExampleKey] = useState<ExampleKey>("as");
  const [issueStart, setIssueStart] = useState(0);
  const orderedIssueCards = [...issueCards.slice(issueStart), ...issueCards.slice(0, issueStart)];
  const example = examples[exampleKey];
  const isAs = locale === "as";
  const workspaceHref = isAuthenticated ? (user.role === "admin" ? "/admin" : user.role === "staff" ? "/staff" : "/app") : "/app";
  const primaryCtaHref = isAuthenticated ? workspaceHref : "/app/new";
  const primaryCtaLabel = isAuthenticated ? tr(locale, "Open workspace", "ৱৰ্কস্পেচ খোলক") : tr(locale, "Report an issue", "সমস্যা জনাওক");
  const secondaryCtaHref = isAuthenticated ? workspaceHref : "/app";
  const secondaryCtaLabel = isAuthenticated ? tr(locale, "Continue to workspace", "ৱর্কস্পেচলৈ আগবাঢ়ক") : tr(locale, "Explore the workspace", "ৱৰ্কস্পেচ চাওক");

  return <main className="landing home-landing" lang={locale}>
    <section className="home-hero">
      <Image src={campusHero} alt="" fill priority sizes="100vw" className="home-campus-image" aria-hidden="true" />
      <div className="home-hero-shade" aria-hidden="true" />
      <div className="home-topbar"><nav className="home-nav" aria-label={tr(locale,"Main navigation","মূল নেভিগেশ্বন")}>
        <Brand light/>
        <div className="home-nav-links"><a href="#how-it-works">{tr(locale,"How it works","ই কেনেকৈ কাম কৰে")}</a><a href="#features">{tr(locale,"Features","সুবিধাসমূহ")}</a><a href="#activity">{tr(locale,"Campus activity","কেম্পাছৰ কাৰ্যকলাপ")}</a><a href="#languages">{tr(locale,"Built for campus","কেম্পাছৰ বাবে নিৰ্মিত")}</a></div>
        <div className="home-nav-actions"><LanguageToggle/>{!isAuthenticated && <Link href="/login" className="home-signin">{tr(locale,"Sign in","ছাইন ইন")}</Link>}<Link href={workspaceHref} className="home-open-workspace">{tr(locale,"Open workspace","ৱৰ্কস্পেচ খোলক")} <ArrowRight size={15}/></Link></div>
      </nav></div>

      <div className="home-hero-content">
        <div className="home-copy">
          <div className="home-eyebrow"><span/>{tr(locale,"Campus issue reporting platform","কেম্পাছৰ সমস্যা জনোৱাৰ মঞ্চ")}</div>
          <h1 className={`home-title ${isAs ? "assamese" : ""}`} lang={locale}>{isAs ? <>সমস্যা দেখিছেনে?<br/><em>সকলোকে জনাওক।</em></> : <>See a problem?<br/><em>Make it visible.</em></>}</h1>
          <p className={`home-description ${isAs ? "assamese" : ""}`} lang={locale}>{isAs ? "অসমীয়া, ৰোমানাইজড অসমীয়া বা ইংৰাজীত কেম্পাছৰ সমস্যা জনাওক। প্ৰতিবেদন অনুসৰণ কৰক, আপডেট চাওক আৰু কেম্পাছে কেনেদৰে সঁহাৰি দিয়ে জানক।" : "Report campus issues in Assamese, Romanised Assamese or English. Track reports, follow updates and see how your campus responds."}</p>
          <div className="home-actions"><Link href={primaryCtaHref} className="home-cta home-cta-light"><FilePlus2 size={18}/>{primaryCtaLabel}<ArrowRight size={16}/></Link><Link href={secondaryCtaHref} className="home-cta home-cta-outline"><Building2 size={17}/>{secondaryCtaLabel}</Link></div>
          <div className="home-signals"><div><Languages/><span><b>{tr(locale,"Multilingual","বহুভাষিক")}</b><small>English · অসমীয়া · Romanised</small></span></div><div><Sparkles/><span><b>{tr(locale,"AI-assisted","এআই সহায়িত")}</b><small>{tr(locale,"Categorization & matching","শ্ৰেণীবিভাজন আৰু মিল")}</small></span></div><div><Layers3/><span><b>{tr(locale,"Transparent","স্বচ্ছ")}</b><small>{tr(locale,"Track every step","প্ৰতিটো পদক্ষেপ চাওক")}</small></span></div></div>
        </div>

        <div className="home-dash" aria-label={tr(locale,"CivicSense issue reporting preview","CivicSense সমস্যা প্ৰতিবেদনৰ আভাস")} onPointerMove={tiltDashboard} onPointerLeave={resetDashboardTilt}>
          <article className="home-glass home-report-card">
            <div className="home-report-head"><span className="home-avatar"><UserRound size={16}/></span><strong>{tr(locale,"New report","নতুন প্ৰতিবেদন")}</strong><time>{tr(locale,"2 min ago","২ মিনিট আগতে")}</time></div>
            <div className="home-report-body"><div><p className="home-source-assamese" lang="as">ছাত্ৰাৱাসৰ তৃতীয় মহলত পানীৰ সমস্যা হৈছে।</p><p className="home-translation">{tr(locale,"Water supply issue on the third floor of the hostel.","ছাত্ৰাৱাসৰ তৃতীয় মহলাত পানী যোগানৰ সমস্যা।")}</p></div><Image src={waterIssue} alt={tr(locale,"Photo showing a water supply issue","পানী যোগানৰ সমস্যাৰ আলোকচিত্ৰ")} width={112} height={94} sizes="112px" className="home-water-photo"/></div>
            <div className="home-report-tags"><span className="home-ai-tag"><Sparkles size={13}/>{tr(locale,"AI: Water Supply","এআই: পানী যোগান")}</span><span className="home-priority-tag"><Flag size={13}/>{tr(locale,"High Priority","উচ্চ অগ্ৰাধিকাৰ")}</span></div>
          </article>

          <article className="home-glass home-activity-card" id="activity">
            <div className="home-card-heading"><strong>{tr(locale,"Campus activity","কেম্পাছৰ কাৰ্যকলাপ")}</strong><span className="home-live"><i/> {tr(locale,"Sample","নমুনা")}</span></div>
            <div className="home-activity-body"><div className="home-mini-map" role="img" aria-label={tr(locale,"Illustrative campus map with issue markers","সমস্যাৰ চিহ্ন থকা কেম্পাছৰ মানচিত্ৰৰ উদাহৰণ")}>
              <svg viewBox="0 0 270 168" role="img" aria-hidden="true"><path className="map-contour" d="M-10 35c30 5 36-20 65-12s22 27 56 22 33-29 69-19 36 31 100 19M-8 119c31-22 48-18 65-7s39 24 69 9 40-28 68-14 47 24 85 6M46-10c-5 28 14 38 6 59S30 84 44 105s40 35 34 76M201-4c-10 31 6 44 0 66s-23 35-11 58 29 25 23 53"/><path className="map-road" d="M-8 94c40-40 63-37 104-12s65 24 91-4 40-36 92-35M111-8c8 30 24 44 45 62s35 38 35 68 5 35 26 54"/><rect x="68" y="56" width="33" height="20" rx="3"/><rect x="128" y="37" width="39" height="27" rx="3"/><rect x="155" y="100" width="43" height="23" rx="3"/><rect x="36" y="110" width="35" height="18" rx="3"/><g className="map-pin pin-open"><circle cx="125" cy="82" r="13"/><text x="125" y="87">!</text></g><g className="map-pin pin-progress"><circle cx="196" cy="76" r="12"/><text x="196" y="81">⌁</text></g><g className="map-pin pin-done"><circle cx="82" cy="92" r="12"/><text x="82" y="97">✓</text></g></svg>
            </div><div className="home-activity-counts"><p><i className="count-open"/><b>12</b>{tr(locale,"Open","মুকলি")}</p><p><i className="count-progress"/><b>5</b>{tr(locale,"In progress","চলি আছে")}</p><p><i className="count-resolved"/><b>18</b>{tr(locale,"Resolved","সমাধান")}</p><small>{tr(locale,"Illustrative preview · not live statistics","উদাহৰণৰ আভাস · বাস্তৱ সময়ৰ তথ্য নহয়")}</small></div></div>
            <Link href={workspaceHref} className="home-map-link">{tr(locale,"Open workspace","ৱৰ্কস্পেচ খোলক")} <ArrowRight size={14}/></Link>
          </article>

          <article className="home-glass home-workflow-card"><strong>{tr(locale,"From report to resolution","প্ৰতিবেদনৰ পৰা সমাধানলৈ")}</strong><ol>{[tr(locale,"Reported","দাখিল"),tr(locale,"Understood by AI","এআইয়ে বুজি পালে"),tr(locale,"Assigned","দায়িত্ব দিয়া হ’ল"),tr(locale,"Resolved","সমাধান")].map((step,index)=><li className={index===1?"is-current":""} key={step}><span>{index===0?<Check size={14}/>:index===1?<Sparkles size={14}/>:index===3?<Check size={14}/>:<UserRound size={14}/>}</span><small>{step}</small></li>)}</ol></article>
        </div>
      </div>
      <div className="home-feature-strip" id="features"><article><Building2/><div><strong>{tr(locale,"Built for real campuses","বাস্তৱ কেম্পাছৰ বাবে")}</strong><p>{tr(locale,"Designed around campus issue reporting and response.","কেম্পাছৰ সমস্যা জনোৱা আৰু সঁহাৰিৰ বাবে নিৰ্মিত।")}</p></div></article><article><Languages/><div><strong>{tr(locale,"Report in your language","নিজৰ ভাষাত জনাওক")}</strong><p>{tr(locale,"English, Assamese or Romanised Assamese.","ইংৰাজী, অসমীয়া বা ৰোমানাইজড অসমীয়া।")}</p></div></article><article><Layers3/><div><strong>{tr(locale,"AI that understands issues","সমস্যা বুজা এআই")}</strong><p>{tr(locale,"Groups related reports and suggests priority.","সম্পৰ্কিত প্ৰতিবেদন মিলাই অগ্ৰাধিকাৰ পৰামৰ্শ দিয়ে।")}</p></div></article><article><CircleCheck/><div><strong>{tr(locale,"Visible and accountable","দৃশ্যমান আৰু জবাবদিহি")}</strong><p>{tr(locale,"Follow progress and see measurable outcomes.","অগ্ৰগতি অনুসৰণ কৰি ফলাফল চাওক।")}</p></div></article></div>
    </section>

    <section className="issue-gallery" aria-labelledby="issue-gallery-title">
      <div className="issue-gallery-inner">
        <div className="issue-gallery-copy"><div className="home-eyebrow issue-eyebrow"><span/>{tr(locale,"The problem","সমস্যাটো")}</div><h2 id="issue-gallery-title">{tr(locale,"Campus issues often get missed, delayed, or unresolved.","কেম্পাছৰ সমস্যাবোৰ প্ৰায়ে চকুত নপৰে, পলম হয় বা সমাধান নোহোৱাকৈ থাকে।")}</h2><p>{tr(locale,"Students face everyday problems like water supply, cleanliness, infrastructure and lighting. Reports are often scattered, hard to track and lack timely action.","পানী যোগান, পৰিষ্কাৰ-পৰিচ্ছন্নতা, আন্তঃগাঁথনি আৰু পোহৰৰ দৰে সমস্যা প্ৰতিদিনে দেখা দিয়ে। অভিযোগবোৰ বহু ঠাইত বিয়পি থাকে আৰু সময়মতে পদক্ষেপ লোৱাটো কঠিন হয়।")}</p></div>
        <div className="issue-gallery-showcase">
          <div className="issue-gallery-toolbar"><div className="issue-gallery-dots" aria-label={tr(locale,"Issue examples","সমস্যাৰ উদাহৰণসমূহ")}>{issueCards.map((card,index)=><button key={card.id} type="button" aria-label={tr(locale,`Show ${card.label} first`,`আগতে ${card.assamese} দেখুৱাওক`)} aria-pressed={issueStart===index} className={issueStart===index?"is-active":""} onClick={()=>setIssueStart(index)}/>)}</div><div className="issue-gallery-arrows"><button type="button" aria-label={tr(locale,"Previous issue example","আগৰ সমস্যা উদাহৰণ")} onClick={()=>setIssueStart((current)=>(current-1+issueCards.length)%issueCards.length)}><ChevronLeft size={17}/></button><button type="button" aria-label={tr(locale,"Next issue example","পৰৱৰ্তী সমস্যা উদাহৰণ")} onClick={()=>setIssueStart((current)=>(current+1)%issueCards.length)}><ChevronRight size={17}/></button></div></div>
          <div className="issue-gallery-cards">{orderedIssueCards.map((card,index)=><article key={card.id} className={`issue-gallery-card ${index===0?"is-featured":""}`}><Image src={card.image} alt={tr(locale,card.alt,card.assamese)} width={480} height={440} sizes="(max-width: 700px) 44vw, (max-width: 1080px) 21vw, 14vw"/><span className="issue-gallery-label"><card.Icon size={14}/>{tr(locale,card.label,card.assamese)}</span></article>)}</div>
        </div>
      </div>
    </section>

    <section className="home-process" id="how-it-works" aria-labelledby="home-process-title"><div className="home-process-inner"><div className="home-process-eyebrow"><span/>{tr(locale,"How CivicSense works","CivicSense কেনেকৈ কাম কৰে")}</div><h2 id="home-process-title">{tr(locale,"From a report to real action.","এটা প্ৰতিবেদনৰ পৰা বাস্তৱ পদক্ষেপলৈ।")}</h2><ol className="home-process-steps"><li><span className="home-process-icon"><Pencil/></span><h3>{tr(locale,"Report","জনাওক")}</h3><p>{tr(locale,"Raise an issue in your preferred language.","আপোনাৰ পছন্দৰ ভাষাত সমস্যাটো জনাওক।")}</p></li><li><span className="home-process-icon"><Sparkles/></span><h3>{tr(locale,"AI understands","এআইয়ে বুজি পায়")}</h3><p>{tr(locale,"Automatically categorizes the issue and finds similar reports.","সমস্যাৰ শ্ৰেণী চিনাক্ত কৰি একে ধৰণৰ প্ৰতিবেদন বিচাৰে।")}</p></li><li><span className="home-process-icon"><UsersRound/></span><h3>{tr(locale,"Assigned","দায়িত্ব দিয়া হয়")}</h3><p>{tr(locale,"Sends it to the right campus authority.","সঠিক কেম্পাছ কৰ্তৃপক্ষৰ ওচৰলৈ পঠিয়ায়।")}</p></li><li><span className="home-process-icon is-resolved"><Check/></span><h3>{tr(locale,"Resolved","সমাধান হয়")}</h3><p>{tr(locale,"Track progress and see the final outcome.","অগ্ৰগতি অনুসৰণ কৰি চূড়ান্ত ফলাফল চাওক।")}</p></li></ol></div></section>

    <section className="semantic-showcase" aria-labelledby="semantic-title">
      <div className="semantic-heading">
        <div><div className="eyebrow"><Sparkles size={13}/>{tr(locale,"Signature AI capability","CivicSense-ৰ বিশেষ এআই সুবিধা")}</div><h2 id="semantic-title">{tr(locale,"Cross-Language Semantic Issue Intelligence","বহুভাষিক অৰ্থভিত্তিক সমস্যা চিনাক্তকৰণ")}</h2><p>{tr(locale,"One campus issue can be described in different words and languages. CivicSense compares the meaning and location, then gives staff a lead to review.","এটা কেম্পাছৰ সমস্যাকে বিভিন্ন ভাষা আৰু শব্দৰে জনাব পাৰি। CivicSense-এ অৰ্থ আৰু স্থান তুলনা কৰি কৰ্মচাৰীৰ পৰ্যালোচনাৰ বাবে সম্ভাৱ্য মিল দেখুৱায়।")}</p></div>
        <div className="semantic-tabs" role="tablist" aria-label={tr(locale,"Choose a source language example","উৎস ভাষাৰ উদাহৰণ বাছক")}>
          {(Object.keys(examples) as ExampleKey[]).map((key)=><button key={key} type="button" role="tab" aria-selected={exampleKey===key} className={exampleKey===key?"active":""} onClick={()=>setExampleKey(key)}>{examples[key].tab}</button>)}
        </div>
      </div>
      <div className="semantic-stage">
        <article className="semantic-source">
          <div className="semantic-card-head"><span><Globe2 size={13}/>{tr(locale,"Original report · source language","মূল প্ৰতিবেদন · উৎস ভাষা")}</span><b className={exampleKey==="as"?"assamese":""} lang={exampleKey==="as"?"as":"en"}>{example.source}</b></div>
          <blockquote className={exampleKey==="as"?"assamese":""} lang={exampleKey==="as"?"as":"en"}>“{example.text}”</blockquote>
          <div className="semantic-source-foot"><span>{tr(locale,"Student Hostel · Third floor","ছাত্ৰাৱাস · তৃতীয় মহলা")}</span><Link href="/app/new">{tr(locale,"Try this in the report form","প্ৰতিবেদন প্ৰপত্ৰত চেষ্টা কৰক")} <ArrowRight size={11}/></Link></div>
        </article>
        <div className="semantic-connector" aria-hidden="true"><span><GitMerge size={15}/></span></div>
        <article className="semantic-result">
          <div className="semantic-result-head"><span><Sparkles size={13}/>{tr(locale,"Illustrative AI analysis","এআই বিশ্লেষণৰ উদাহৰণ")}</span><b>{tr(locale,"Example match","উদাহৰণৰ মিল")} · {example.score}</b></div>
          <div className="semantic-facts"><div><small>{tr(locale,"Detected source language","চিনাক্ত উৎস ভাষা")}</small><strong className={exampleKey==="as"?"assamese":""}>{example.language}</strong></div><div><small>{tr(locale,"Suggested category","পৰামৰ্শ দিয়া শ্ৰেণী")}</small><strong>{tr(locale,"Water supply / plumbing","পানী যোগান / নল-নৰ্দমা")}</strong></div><div><small>{tr(locale,"Suggested priority","পৰামৰ্শ দিয়া অগ্ৰাধিকাৰ")}</small><strong className="priority-text">{tr(locale,"Urgent","জৰুৰী")}</strong></div></div>
          <div className="semantic-summaries"><div><small>English · summary</small><p>{example.englishSummary}</p></div><div className="assamese" lang="as"><small>অসমীয়া · সাৰাংশ</small><p>{example.assameseSummary}</p></div></div>
          <div className="semantic-cluster"><div><GitMerge size={13}/><span>{tr(locale,"Related issue cluster","সম্পৰ্কিত সমস্যা ক্লাষ্টাৰ")}</span><strong>CS-2026-0081</strong></div><p>{tr(locale,"Hostel water supply interruption","হোষ্টেলৰ পানী যোগান ব্যাহত")}</p></div>
        </article>
      </div>
      <div className="semantic-footnote"><span>{tr(locale,"Example scores are illustrative. Live suggestions are reviewed by campus staff before reports are grouped.","মিলৰ নম্বৰসমূহ উদাহৰণস্বৰূপ। প্ৰতিবেদন একেলগ কৰাৰ আগতে কেম্পাছৰ কৰ্মচাৰীয়ে প্ৰতিটো পৰামৰ্শ পৰ্যালোচনা কৰে।")}</span><Link href="/admin/clusters">{tr(locale,"See how clusters are reviewed","ক্লাষ্টাৰ কেনেকৈ পৰ্যালোচনা কৰা হয় চাওক")} <ArrowRight size={11}/></Link></div>
    </section>

    <section className="home-why" id="languages" aria-labelledby="home-why-title"><div className="home-why-inner"><div className="home-why-intro"><div className="home-eyebrow issue-eyebrow"><span/>{tr(locale,"Why CivicSense","CivicSense কিয়")}</div><h2 id="home-why-title">{tr(locale,"A smarter, more accountable campus.","অধিক বুদ্ধিদীপ্ত আৰু জবাবদিহি কেম্পাছ।")}</h2></div><article><Zap/><div><h3>{tr(locale,"Faster response","দ্ৰুত সঁহাৰি")}</h3><p>{tr(locale,"Get issues to the right team quickly.","সমস্যাবোৰ সোনকালে সঠিক দলৰ ওচৰ পায়।")}</p></div></article><article><Layers3/><div><h3>{tr(locale,"Clear tracking","স্পষ্ট অনুসৰণ")}</h3><p>{tr(locale,"Follow updates in one place.","এটা ঠাইতে সকলো আপডেট অনুসৰণ কৰক।")}</p></div></article><article><ShieldCheck/><div><h3>{tr(locale,"Campus transparency","কেম্পাছৰ স্বচ্ছতা")}</h3><p>{tr(locale,"A structured and accountable process.","সুশৃংখল আৰু জবাবদিহি প্ৰক্ৰিয়া।")}</p></div></article></div></section>

    <section className="home-invitation"><div className="home-invitation-title"><h2>{tr(locale,"Get involved.","আহক, অংশ লওক।")}</h2><span/></div><p>{tr(locale,"Join CivicSense and help make your campus cleaner, safer and more responsive.","CivicSense-ত যোগ দি আপোনাৰ কেম্পাছক অধিক পৰিষ্কাৰ, সুৰক্ষিত আৰু সঁহাৰিশীল কৰাত সহায় কৰক।")}</p><Link href={primaryCtaHref} className="home-invitation-cta">{tr(locale,"Get started","আৰম্ভ কৰক")} <ArrowRight size={16}/></Link></section>

    <footer className="new-landing-footer"><div className="new-footer-left"><Languages size={15}/><span>অসমীয়া · English</span><i/> <span>{tr(locale,"Built for campus communities","কেম্পাছৰ সমাজৰ বাবে নিৰ্মিত")}</span></div><div className="new-footer-right"><Check size={14}/>{tr(locale,"Campus problems understood. Actions made visible.","কেম্পাছৰ সমস্যা বুজি, সমাধান দৃশ্যমান কৰক।")}</div></footer>
  </main>;
}
