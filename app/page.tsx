"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownRight, ArrowRight, Check, GitMerge, Globe2, Languages, ShieldCheck, Sparkles } from "lucide-react";
import { Brand, CampusIllustration } from "@/components/brand";
import { LanguageToggle } from "@/components/language-toggle";
import { useWorkspace } from "@/components/workspace-provider";
import { tr } from "@/lib/i18n";

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

export default function LandingPage() {
  const { locale } = useWorkspace();
  const [exampleKey, setExampleKey] = useState<ExampleKey>("as");
  const example = examples[exampleKey];
  const isAs = locale === "as";

  return <main className="landing" lang={locale}>
    <nav className="landing-nav">
      <Brand/>
      <div className="nav-links"><a href="#how-it-works">{tr(locale,"How it works","ই কেনেকৈ কাম কৰে")}</a><a href="#languages">{tr(locale,"Built for campus","কেম্পাছৰ বাবে নিৰ্মিত")}</a></div>
      <div className="nav-actions"><LanguageToggle/><Link href="/login" className="button button-outline button-small">{tr(locale,"Sign in","ছাইন ইন")}</Link><Link href="/app" className="button button-primary button-small">{tr(locale,"Open workspace","ৱৰ্কস্পেচ খোলক")} <ArrowRight size={13}/></Link></div>
    </nav>
    <section className="landing-hero">
      <div><div className="eyebrow"><span className="eyebrow-mark"/>{isAs ? "ডিব্ৰুগড় বিশ্ববিদ্যালয় · কেম্পাছ সেৱা" : "Dibrugarh University · Campus services"}</div>
        <h1 className={`hero-title ${isAs ? "assamese" : ""}`} lang={locale}>{isAs ? <>কেম্পাছৰ সমস্যা বুজি,<br/><em>সমাধান দৃশ্যমান</em> কৰক।</> : <>Campus problems<br/>understood. <em>Actions<br/>made visible.</em></>}</h1>
        <p className={`hero-copy ${isAs ? "assamese" : ""}`} lang={locale}>{isAs ? "অসমীয়া, ৰোমানাইজড অসমীয়া বা ইংৰাজীত কেম্পাছৰ সমস্যাৰ প্ৰতিবেদন দিয়ক। CivicSense-এ প্ৰতিবেদনসমূহ সংযোগ কৰে আৰু প্ৰতিটো পদক্ষেপ দৃশ্যমান কৰে।" : "Report a campus issue in Assamese, Romanised Assamese, or English. CivicSense connects related concerns and makes each step toward a response visible."}</p>
        <div className="hero-actions"><Link href="/app/new" className="button button-terracotta">{tr(locale,"Report an issue","সমস্যা জনাওক")} <ArrowRight size={15}/></Link><Link href="/app" className="button button-outline">{tr(locale,"Explore the workspace","ৱৰ্কস্পেচ চাওক")} <ArrowDownRight size={14}/></Link></div>
        <div className="hero-footnote"><ShieldCheck size={15}/> {tr(locale,"A clearer line between a campus concern and campus action.","কেম্পাছৰ সমস্যা আৰু তাৰ সমাধানৰ মাজত স্পষ্ট সংযোগ।")}</div>
      </div>
      <div className="hero-visual"><div className="hero-index">FIELD NOTES / 01</div><div className="visual-frame"><CampusIllustration/><div className="visual-stamp">{isAs ? <>শুনে<br/>বুজে<br/>সঁহাৰি দিয়ে</> : <>A campus<br/>that listens<br/>and responds</>}</div></div><div className="visual-card"><div className="visual-card-head"><span>{tr(locale,"Facilities · active","সা-সুবিধা · সক্ৰিয়")}</span><span className="live-dot"/></div><h3>{tr(locale,"Water on the third floor","তৃতীয় মহলাত পানী নাই")}</h3><p>{tr(locale,"Moirabari Hostel · Reported in Assamese","মৈৰাবাৰী হোষ্টেল · অসমীয়াত দাখিল")}</p></div></div>
    </section>

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
          <div className="semantic-source-foot"><span>{tr(locale,"Boys Hostel 3 · Third floor","বয়জ হোষ্টেল ৩ · তৃতীয় মহলা")}</span><Link href="/app/new">{tr(locale,"Try this in the report form","প্ৰতিবেদন প্ৰপত্ৰত চেষ্টা কৰক")} <ArrowRight size={11}/></Link></div>
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

    <section className="capability-grid" id="languages">
      <article><span className="capability-mark"><Languages size={17}/></span><div className="section-kicker">01 / {tr(locale,"Language","ভাষা")}</div><h3>{tr(locale,"Your words stay yours.","আপোনাৰ ভাষা, আপোনাৰ কথাই থাকে।")}</h3><p>{tr(locale,"Submit in Assamese script, Romanised Assamese, English, or a mix. The original report stays attached to its source language.","অসমীয়া লিপি, ৰোমানাইজড অসমীয়া, ইংৰাজী বা মিহলি ভাষাত লিখক। মূল প্ৰতিবেদন নিজৰ উৎস ভাষাতে সংৰক্ষিত থাকে।")}</p></article>
      <article><span className="capability-mark"><ShieldCheck size={17}/></span><div className="section-kicker">02 / {tr(locale,"Evidence","প্ৰমাণ")}</div><h3>{tr(locale,"Useful context for the right team.","সঠিক দলৰ বাবে প্ৰয়োজনীয় তথ্য।")}</h3><p>{tr(locale,"Add a location and optional photo. AI helps structure what is reported; campus staff make the final decision.","স্থান আৰু ইচ্ছা কৰিলে আলোকচিত্ৰ যোগ কৰক। এআই-এ প্ৰতিবেদন সজাই দিয়ে; চূড়ান্ত সিদ্ধান্ত কেম্পাছৰ কৰ্মচাৰীয়ে লয়।")}</p></article>
      <article><span className="capability-mark"><GitMerge size={17}/></span><div className="section-kicker">03 / {tr(locale,"Follow-through","পদক্ষেপ")}</div><h3>{tr(locale,"See the work move forward.","কাম আগবঢ়া দেখক।")}</h3><p>{tr(locale,"Teams assign, update, and group related reports. Reporters can follow the status and see what happened.","দলে দায়িত্ব দিয়ে, স্থিতি সলনি কৰে আৰু সম্পৰ্কিত প্ৰতিবেদন একেলগ কৰে। প্ৰতিবেদন দিওঁতাই প্ৰতিটো পদক্ষেপ অনুসৰণ কৰিব পাৰে।")}</p></article>
    </section>

    <section className="process-strip" id="how-it-works"><div className="process-inner"><div className="process-title"><div><div className="eyebrow" style={{color:"#bdc7bf"}}><span className="eyebrow-mark"/>{tr(locale,"A more useful way to report","সমস্যা জনোৱাৰ এক সহজ উপায়")}</div><h2>{tr(locale,"From a sentence to a campus response.","এটা বাক্যৰ পৰা কেম্পাছৰ সঁহাৰিলৈ।")}</h2></div><p>{tr(locale,"Local language, location context, and related reports come together in one clear view for the people who can act.","স্থানীয় ভাষা, স্থানৰ তথ্য আৰু সম্পৰ্কিত প্ৰতিবেদন একেলগে আহে—যিসকলে পদক্ষেপ ল’ব পাৰে তেওঁলোকৰ বাবে।")}</p></div><div className="process-grid"><article className="process-step"><span className="step-no">01 / {tr(locale,"Tell us","জনাওক")}</span><h3>{tr(locale,"Say it in your words","নিজৰ ভাষাত কওক")}</h3><p>{tr(locale,"Write in Assamese, English, or Romanised Assamese. Add a photo and a campus location when you can.","অসমীয়া, ইংৰাজী বা ৰোমানাইজড অসমীয়াত লিখক। পাৰিলে আলোকচিত্ৰ আৰু কেম্পাছৰ স্থান যোগ কৰক।")}</p></article><article className="process-step"><span className="step-no">02 / {tr(locale,"Connect","সংযোগ")}</span><h3>{tr(locale,"See the shared picture","একেলগে সম্পৰ্কিত সমস্যাবোৰ চাওক")}</h3><p>{tr(locale,"AI prepares bilingual summaries and suggests when another report might describe the same campus issue.","এআই-এ দুয়োটা ভাষাত সাৰাংশ তৈয়াৰ কৰে আৰু একে সমস্যাৰ আন প্ৰতিবেদনৰ সম্ভাৱ্য মিল দেখুৱায়।")}</p></article><article className="process-step"><span className="step-no">03 / {tr(locale,"Follow through","অনুসৰণ")}</span><h3>{tr(locale,"Know what happens next","পিছত কি হ’ল জানক")}</h3><p>{tr(locale,"Teams can assign and update an issue. Reporters can follow the status and see the action taken.","দলে সমস্যাৰ দায়িত্ব লৈ স্থিতি আপডেট কৰে। প্ৰতিবেদন দিওঁতাই সমাধানৰ পদক্ষেপ চাব পাৰে।")}</p></article></div></div></section>
    <footer className="landing-bottom"><div className="bottom-note"><Languages size={14}/><b>অসমীয়া + English</b><span>·</span><span>{tr(locale,"Built for Dibrugarh University","ডিব্ৰুগড় বিশ্ববিদ্যালয়ৰ বাবে নিৰ্মিত")}</span></div><div className="bottom-note"><Check size={13}/>{tr(locale,"Campus problems understood. Actions made visible.","কেম্পাছৰ সমস্যা বুজি, সমাধান দৃশ্যমান কৰক।")}</div></footer>
  </main>;
}
