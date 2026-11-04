"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace-provider";
import { campusDepartments } from "@/lib/departments";
import { categories, type Category } from "@/lib/types";
import { tr } from "@/lib/i18n";

type Route = { category: Category; department: string | null; updated_at?: string };
export function CategoryRouting() {
  const { locale } = useWorkspace();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [staffed, setStaffed] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/admin/category-routing", { cache: "no-store" }).then(async (res) => {
      const body = await res.json(); if (!res.ok) throw new Error(body.error || "Routing rules could not be loaded.");
      if (!active) return;
      setRoutes(body.routes || []); setStaffed(body.staffedDepartments || []);
      setDrafts(Object.fromEntries((body.routes || []).map((r: Route) => [r.category, r.department || ""])));
    }).catch((error) => { if (active) toast.error(error instanceof Error ? error.message : "Routing rules could not be loaded."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function save(category: Category) {
    setSaving(category);
    try {
      const response = await fetch("/api/admin/category-routing", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, department: drafts[category] || null }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Routing rule could not be saved.");
      setRoutes((current) => current.map((route) => route.category === category ? body.route : route));
      toast.success(tr(locale, "Routing rule saved.", "ৰাউটিং নিয়ম সংৰক্ষণ হ’ল।"));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Routing rule could not be saved."); }
    finally { setSaving(null); }
  }
  return <>
    <div className="page-heading"><div><div className="section-kicker">{tr(locale, "Administration · Workflow", "প্ৰশাসন · কাৰ্যপ্ৰবাহ")}</div><h1>{tr(locale, "Department routing", "বিভাগলৈ ৰাউটিং")}</h1><p>{tr(locale, "Set the default team for each AI-confirmed category. Issue-specific rules can override the default; unrouted reports stay in the admin triage queue.", "এআইয়ে নিশ্চিত কৰা প্ৰতিটো শ্ৰেণীৰ বাবে বিভাগ নিৰ্ধাৰণ কৰক। বিশেষ সমস্যাৰ নিয়মে ডিফল্ট সলনি কৰিব পাৰে; ৰাউট নোহোৱা প্ৰতিবেদন প্ৰশাসকৰ পৰ্যালোচনাত থাকিব।")}</p></div></div>
    <section className="panel routing-panel"><div className="section-kicker">{tr(locale, "Category defaults", "শ্ৰেণীৰ ডিফল্ট বিভাগ")}</div><h2>{tr(locale, "Where should reports go?", "প্ৰতিবেদন ক’লৈ যাব লাগে?")}</h2>{loading ? <p>{tr(locale, "Loading routing rules…", "ৰাউটিং নিয়ম লোড হৈছে…")}</p> : categories.map((category) => { const route = routes.find((item) => item.category === category); const value = drafts[category] ?? route?.department ?? ""; return <div className="routing-row" key={category}><strong>{category}</strong><select value={value} onChange={(event) => setDrafts((current) => ({ ...current, [category]: event.target.value }))}><option value="">Admin triage · no automatic team</option>{campusDepartments.map((department) => <option value={department} key={department}>{department}{staffed.includes(department) ? "" : " · no staff assigned"}</option>)}</select><button type="button" className="button button-outline button-small" disabled={saving === category || value === (route?.department || "")} onClick={() => void save(category)}>{saving === category ? tr(locale, "Saving…", "সংৰক্ষণ হৈছে…") : <><Check size={14}/>{tr(locale, "Save", "সংৰক্ষণ")}</>}</button></div>; })}
      <p className="field-hint">{tr(locale, "Unassigned categories remain visible to administrators for triage. Team access controls which staff can see a department’s queue.", "দায়িত্ব দিয়া নোহোৱা শ্ৰেণী প্ৰশাসকে পৰ্যালোচনা কৰিব। Team access-এ বিভাগৰ কাম কোন কৰ্মচাৰীয়ে চাব পাৰিব সেয়া নিৰ্ধাৰণ কৰে।")}</p>
    </section>
  </>;
}
