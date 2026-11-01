"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Search, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace-provider";
import { roleLabel, tr } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import type { UserRole } from "@/lib/types";

type TeamMember = { id: string; full_name: string; role: UserRole; department: string | null; created_at: string };
const departments = ["Facilities & Maintenance", "Electrical Services", "IT Services", "Library Services", "Sanitation & Waste", "Student Housing", "Health Services"];

export function TeamAccess() {
  const { locale } = useWorkspace();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { role: "student" | "staff"; department: string }>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/admin/team", { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Team accounts could not be loaded.");
      if (!active) return;
      const rows = body.users as TeamMember[];
      setMembers(rows);
      setDrafts(Object.fromEntries(rows.map((member) => [member.id, { role: member.role === "staff" ? "staff" : "student", department: member.department || "" }])));
    }).catch((error) => { if (active) toast.error(error instanceof Error ? error.message : "Team accounts could not be loaded."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const visible = useMemo(() => members.filter((member) => `${member.full_name} ${member.department || ""} ${member.role}`.toLowerCase().includes(search.toLowerCase())), [members, search]);
  async function save(member: TeamMember) {
    const draft = drafts[member.id];
    if (!draft || member.role === "admin") return;
    setSavingId(member.id);
    try {
      const response = await fetch("/api/admin/team", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: member.id, role: draft.role, department: draft.role === "staff" ? draft.department : null }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Team access could not be updated.");
      setMembers((current) => current.map((item) => item.id === member.id ? body.user as TeamMember : item));
      toast.success(tr(locale, "Team access updated.", "দলৰ প্ৰৱেশাধিকাৰ আপডেট কৰা হ’ল।"));
    } catch (error) { toast.error(error instanceof Error ? error.message : tr(locale, "Team access could not be updated.", "দলৰ প্ৰৱেশাধিকাৰ আপডেট কৰিব পৰা নগ’ল।")); }
    finally { setSavingId(null); }
  }

  return <>
    <div className="page-heading"><div><div className="section-kicker">{tr(locale, "Administration · Access", "প্ৰশাসন · প্ৰৱেশাধিকাৰ")}</div><h1>{tr(locale, "Team access", "দলৰ প্ৰৱেশাধিকাৰ")}</h1><p>{tr(locale, "Assign staff roles and departments. Staff can only work reports assigned to their department.", "কৰ্মচাৰীৰ ভূমিকা আৰু বিভাগ নিৰ্ধাৰণ কৰক। কৰ্মচাৰীয়ে নিজৰ বিভাগক দিয়া প্ৰতিবেদনতহে কাম কৰিব পাৰে।")}</p></div><div className="team-count"><UsersRound size={18}/><strong>{members.filter((member) => member.role === "staff").length}</strong><span>{tr(locale, "staff accounts", "টা কৰ্মচাৰী একাউণ্ট")}</span></div></div>
    <section className="team-panel panel"><div className="team-toolbar"><div><div className="section-kicker">{tr(locale, "Campus accounts", "কেম্পাছৰ একাউণ্ট")}</div><h2>{tr(locale, "Manage roles and departments", "ভূমিকা আৰু বিভাগ পৰিচালনা কৰক")}</h2></div><div className="search-field"><Search size={16}/><input aria-label={tr(locale, "Search team members", "দলৰ সদস্য বিচাৰক")} placeholder={tr(locale, "Search by name or department", "নাম বা বিভাগেৰে বিচাৰক")} value={search} onChange={(event) => setSearch(event.target.value)}/></div></div>
      {loading ? <div className="empty-state"><p>{tr(locale, "Loading campus accounts…", "কেম্পাছৰ একাউণ্ট লোড হৈছে…")}</p></div> : visible.length ? <div className="team-list">{visible.map((member) => {
        const draft = drafts[member.id] || { role: member.role === "staff" ? "staff" as const : "student" as const, department: member.department || "" };
        const dirty = member.role !== draft.role || (member.department || "") !== (draft.role === "staff" ? draft.department : "");
        return <article className="team-member" key={member.id}><div className="team-member-identity"><span className="team-avatar">{member.full_name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{member.full_name}</strong><span>{tr(locale, "Joined", "যোগ দিছিল")} {formatDate(member.created_at, false, locale)}</span></div></div><div className="team-member-access"><label>{tr(locale, "Role", "ভূমিকা")}<select disabled={member.role === "admin"} value={draft.role} onChange={(event) => setDrafts((current) => ({ ...current, [member.id]: { ...draft, role: event.target.value as "student" | "staff" } }))}><option value="student">{roleLabel("student", locale)}</option><option value="staff">{roleLabel("staff", locale)}</option></select></label>{member.role === "admin" ? <span className="admin-account-note">{roleLabel("admin", locale)} · {tr(locale, "managed separately", "বেলেগকৈ পৰিচালিত")}</span> : draft.role === "staff" ? <label>{tr(locale, "Department", "বিভাগ")}<select value={draft.department} onChange={(event) => setDrafts((current) => ({ ...current, [member.id]: { ...draft, department: event.target.value } }))}><option value="">{tr(locale, "Choose a department", "বিভাগ বাছক")}</option>{draft.department && !departments.includes(draft.department) && <option value={draft.department}>{draft.department}</option>}{departments.map((department) => <option key={department} value={department}>{department}</option>)}</select></label> : <span className="admin-account-note">{tr(locale, "Student access", "ছাত্ৰৰ প্ৰৱেশাধিকাৰ")}</span>}</div><button className="button button-outline button-small team-save" disabled={!dirty || savingId === member.id || member.role === "admin"} onClick={() => void save(member)}>{savingId === member.id ? tr(locale, "Saving…", "সংৰক্ষণ হৈছে…") : <><Check size={14}/>{tr(locale, "Save access", "প্ৰৱেশাধিকাৰ সংৰক্ষণ")}</>}</button></article>;
      })}</div> : <div className="empty-state"><UsersRound size={21}/><h3>{tr(locale, "No campus accounts found", "কেম্পাছৰ একাউণ্ট পোৱা নগ’ল")}</h3></div>}
    </section>
    <p className="field-hint team-footnote">{tr(locale, "New registrations start as student accounts. Promote a verified campus employee here; administrator privileges remain provisioned separately.", "নতুন পঞ্জীয়ন ছাত্ৰ একাউণ্ট হিচাপে আৰম্ভ হয়। পৰীক্ষা কৰা কৰ্মচাৰীক ইয়াত উন্নীত কৰক; প্ৰশাসকৰ বিশেষাধিকাৰ বেলেগকৈ নিৰ্ধাৰণ কৰা হয়।")}</p>
  </>;
}
