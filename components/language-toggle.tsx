"use client";

import { Globe2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useWorkspace();
  const next = locale === "en" ? "as" : "en";
  return <button
    type="button"
    className={`language-select language-toggle ${className}`}
    aria-label={locale === "en" ? "Switch the whole site to Assamese" : "Switch the whole site to English"}
    title={locale === "en" ? "অসমীয়া ইণ্টাৰফেচলৈ সলনি কৰক" : "Switch interface to English"}
    onClick={() => void setLocale(next)}
  >
    <Globe2 size={14}/><span className="language-toggle-label" data-short-label={locale === "as" ? "অসমীয়া" : "EN"}>{locale === "as" ? "অসমীয়া" : "English"}</span><span aria-hidden="true">⌄</span>
  </button>;
}
