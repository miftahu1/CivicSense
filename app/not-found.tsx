"use client";

import Link from "next/link";
import { ArrowLeft, Globe2 } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { useWorkspace } from "@/components/workspace-provider";
import { Brand } from "@/components/brand";
import { tr } from "@/lib/i18n";

export default function NotFound() {
  const { locale } = useWorkspace();
  return <main className="landing not-found-page" lang={locale}><nav className="landing-nav"><Brand/><div className="nav-actions"><LanguageToggle/><Link href="/app" className="button button-outline button-small">{tr(locale,"Open workspace","ৱৰ্কস্পেচ খোলক")}</Link></div></nav><section className="not-found-content"><div className="eyebrow"><Globe2 size={13}/>{tr(locale,"CivicSense · Campus services","CivicSense · কেম্পাছ সেৱা")}</div><div className="not-found-code">404</div><h1>{tr(locale,"This page isn’t on the campus map.","এই পৃষ্ঠাটো কেম্পাছৰ মানচিত্ৰত নাই।")}</h1><p>{tr(locale,"The page may have moved, or the address may be incomplete. Head back to your workspace to continue.","পৃষ্ঠাটো হয়তো স্থানান্তৰিত হৈছে, অথবা ঠিকনাটো সম্পূৰ্ণ নহয়। আপোনাৰ কাম আগবঢ়াবলৈ ৱৰ্কস্পেচলৈ উভতি যাওক।")}</p><Link className="button button-terracotta" href="/app"><ArrowLeft size={14}/>{tr(locale,"Back to workspace","ৱৰ্কস্পেচলৈ উভতি যাওক")}</Link></section></main>;
}
