"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace-provider";
import { tr } from "@/lib/i18n";

export function PublicIssueBoardToggle() {
  const { locale } = useWorkspace();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/admin/public-issues", { cache: "no-store" }).then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Public issue board status could not be loaded.");
        setEnabled(Boolean(body.enabled));
      }).catch((error) => toast.error(error instanceof Error ? error.message : "Public issue board status could not be loaded."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function toggle() {
    if (enabled === null) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/public-issues", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !enabled }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Public issue board could not be updated.");
      setEnabled(Boolean(body.enabled));
      toast.success(tr(locale, body.enabled ? "Public issue page enabled." : "Public issue page disabled.", body.enabled ? "ৰাজহুৱা সমস্যা পৃষ্ঠা চালু কৰা হ’ল।" : "ৰাজহুৱা সমস্যা পৃষ্ঠা বন্ধ কৰা হ’ল।"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Public issue board could not be updated.");
    } finally { setBusy(false); }
  }

  return <div className="public-board-admin-control">
    <button type="button" className={`public-board-toggle ${enabled ? "is-enabled" : ""}`} role="switch" aria-checked={Boolean(enabled)} disabled={enabled === null || busy} onClick={() => void toggle()}>
      {enabled ? <Eye size={15}/> : <EyeOff size={15}/>}
      {enabled === null ? tr(locale, "Checking public page…", "ৰাজহুৱা পৃষ্ঠা পৰীক্ষা কৰা হৈছে…") : enabled ? tr(locale, "Disable public page", "ৰাজহুৱা পৃষ্ঠা বন্ধ কৰক") : tr(locale, "Enable public page", "ৰাজহুৱা পৃষ্ঠা চালু কৰক")}
    </button>
    {enabled && <Link href="/issues" target="_blank" rel="noreferrer">{tr(locale, "View public page", "ৰাজহুৱা পৃষ্ঠা চাওক")}<ArrowUpRight size={13}/></Link>}
  </div>;
}
