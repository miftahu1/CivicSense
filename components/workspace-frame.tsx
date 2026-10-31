"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Activity, Bell, Building2, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, FilePlus2, FolderKanban, Home, Layers3, LogOut, ShieldCheck, UsersRound } from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageToggle } from "@/components/language-toggle";
import { useWorkspace } from "@/components/workspace-provider";
import { ReportDetailDialog } from "@/components/report-detail-dialog";
import { roleLabel, tr } from "@/lib/i18n";
import type { UserRole } from "@/lib/types";

export function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const router = useRouter();
  const { user, locale, isDemo, setDemoRole, signOut, reports, selectedReportId, closeReport, authReady } = useWorkspace();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (!authReady) return;
    if (user.role === "admin" && pathname.startsWith("/app")) router.replace("/admin");
    else if (user.role === "staff" && (pathname.startsWith("/admin") || pathname === "/app")) router.replace("/staff");
    else if (user.role === "student" && (pathname.startsWith("/admin") || pathname.startsWith("/staff"))) router.replace("/app");
  }, [authReady, pathname, router, user.role]);
  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    if (selectedReportId) queueMicrotask(closeReport);
  }, [pathname, selectedReportId, closeReport]);
  const studentNav = [
    { href: "/app", label: tr(locale, "Overview", "পৰিচিতি"), icon: Home },
    { href: "/app/new", label: tr(locale, "New report", "নতুন প্ৰতিবেদন"), icon: FilePlus2 },
    { href: "/app/reports", label: tr(locale, "My reports", "মোৰ প্ৰতিবেদন"), icon: ClipboardList },
  ];
  const adminNav = [
    { href: "/admin", label: tr(locale, "Operations overview", "কাৰ্য্যকলাপৰ পৰিচিতি"), icon: Home },
    { href: "/admin/issues", label: tr(locale, "Issue desk", "অভিযোগৰ ডেস্ক"), icon: ClipboardList },
    { href: "/admin/clusters", label: tr(locale, "Issue clusters", "সমস্যাৰ ক্লাষ্টাৰ"), icon: Layers3 },
    { href: "/admin/team", label: tr(locale, "Team access", "দলৰ প্ৰৱেশাধিকাৰ"), icon: UsersRound },
  ];
  const staffNav = [
    { href: "/staff", label: tr(locale, "Assigned work", "দায়িত্ব দিয়া কাম"), icon: ClipboardList },
    { href: "/app/new", label: tr(locale, "Report an issue", "সমস্যা জনাওক"), icon: FilePlus2 },
    { href: "/app/reports", label: tr(locale, "My reports", "মোৰ প্ৰতিবেদন"), icon: Home },
  ];
  const nav = user.role === "admin" ? adminNav : user.role === "staff" ? staffNav : studentNav;
  const pageTitle = [...studentNav, ...staffNav, ...adminNav].find((item) => item.href === pathname)?.label ?? (pathname.includes("/reports/") ? tr(locale, "Report details", "প্ৰতিবেদনৰ বিৱৰণ") : pathname.startsWith("/staff") ? tr(locale, "Assigned work", "দায়িত্ব দিয়া কাম") : tr(locale, "New report", "নতুন প্ৰতিবেদন"));
  const unread = reports.some((report) => report.reporterId === user.id && report.events.length > 0);
  const mobileNav = nav;

  return <div className={`workspace ${collapsed ? "sidebar-collapsed" : ""}`} lang={locale}>
    <aside className="sidebar" aria-label={tr(locale, "Main navigation", "মূল নেভিগেচন")}>
      <div className="sidebar-top"><Brand light href={user.role === "admin" ? "/admin" : "/app"}/><button className="collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? tr(locale, "Expand sidebar", "কাষৰ তালিকা বহল কৰক") : tr(locale, "Collapse sidebar", "কাষৰ তালিকা সৰু কৰক")}>{collapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}</button></div>
      <div className="sidebar-section"><div className="nav-label">{tr(locale, "Workspace", "ৱৰ্কস্পেচ")}</div>{nav.map((item) => {
        const Icon = item.icon; const active = pathname === item.href || (item.href.endsWith("issues") && pathname.startsWith("/admin/issues")) || (item.href === "/app/reports" && pathname.startsWith("/app/reports/"));
        return <Link key={item.href} href={item.href} className={`side-link ${active ? "active" : ""}`} title={item.label}><Icon size={16}/><span>{item.label}</span></Link>;
      })}</div>
      {user.role !== "admin" && <div className="sidebar-section"><div className="nav-label">{tr(locale, "Campus", "কেম্পাছ")}</div><a href="#workspace-info" onClick={(event) => { event.preventDefault(); document.getElementById("workspace-info")?.scrollIntoView({ behavior: "smooth" }); }} className="side-link" title={tr(locale, "Campus services", "কেম্পাছ সেৱা")}><Building2 size={16}/><span>{tr(locale, "Campus services", "কেম্পাছ সেৱা")}</span></a><Link href="/app" className="side-link" title={tr(locale, "Recent activity", "শেহতীয়া কাৰ্যকলাপ")}><Activity size={16}/><span>{tr(locale, "Recent activity", "শেহতীয়া কাৰ্যকলাপ")}</span></Link></div>}
      {user.role === "admin" && <div className="sidebar-section"><div className="nav-label">{tr(locale, "Administration", "প্ৰশাসন")}</div><Link href="/admin/issues" className="side-link" title={tr(locale, "Review queue", "পৰ্যালোচনাৰ শাৰী")}><ShieldCheck size={16}/><span>{tr(locale, "Review queue", "পৰ্যালোচনাৰ শাৰী")}</span></Link><Link href="/admin/clusters" className="side-link" title={tr(locale, "Manage clusters", "ক্লাষ্টাৰ পৰিচালনা")}><FolderKanban size={16}/><span>{tr(locale, "Manage clusters", "ক্লাষ্টাৰ পৰিচালনা")}</span></Link></div>}
      <div className="sidebar-bottom"><Link href="/" className="help-link"><CircleHelp size={15}/><span>{tr(locale, "About CivicSense", "CivicSense-ৰ বিষয়ে")}</span></Link><div className="demo-mode"><strong><span className="live-dot"/> {isDemo ? tr(locale, "Demonstration", "ডেম’") : tr(locale, "Connected", "সংযুক্ত")}</strong>{isDemo ? tr(locale, "Synthetic campus reports. Changes save in this browser.", "কল্পিত কেম্পাছৰ প্ৰতিবেদন। সলনিসমূহ এই ব্ৰাউজাৰত সংৰক্ষিত হয়।") : tr(locale, "Signed in to your campus workspace.", "আপুনি কেম্পাছৰ ৱৰ্কস্পেচত ছাইন ইন কৰিছে।")}</div></div>
    </aside>
    <div className="main-area">
      <header className="topbar">
        <div className="crumbs"><span>{tr(locale, "Campus operations", "কেম্পাছ পৰিচালনা")}</span><span>›</span><strong>{pageTitle}</strong></div>
        <div className="topbar-actions">
          <LanguageToggle/>
          {isDemo && <label className="visually-hidden" htmlFor="demo-role">{tr(locale, "Demo role", "ডেম’ ভূমিকা")}</label>}
          {isDemo && <select id="demo-role" className="role-switch" aria-label={tr(locale, "Switch demonstration role", "ডেম’ ভূমিকা সলনি কৰক")} value={user.role} onChange={(event) => setDemoRole(event.target.value as UserRole)}><option value="student">{tr(locale, "Demo · student", "ডেম’ · ছাত্ৰ")}</option><option value="staff">{tr(locale, "Demo · staff", "ডেম’ · কৰ্মচাৰী")}</option><option value="admin">{tr(locale, "Demo · admin", "ডেম’ · প্ৰশাসক")}</option></select>}
          <button className="icon-button" aria-label={tr(locale, "Notifications", "জাননী")} title={tr(locale, "Recent status updates", "শেহতীয়া স্থিতিৰ আপডেট")} onClick={() => { if (user.role === "admin") { router.push("/admin/issues"); return; } const first = reports.find((report) => report.reporterId === user.id && report.events.length); if (first) router.push(`/app/reports/${first.id}`); }}><Bell size={17}/>{unread && <span className="notification-dot"/>}</button>
          {isDemo ? <Link href="/login" className="button button-outline button-small">{tr(locale, "Sign in", "ছাইন ইন")}</Link> : <button className="icon-button" aria-label={tr(locale, "Sign out", "ছাইন আউট")} title={tr(locale, "Sign out", "ছাইন আউট")} onClick={() => void signOut()}><LogOut size={16}/></button>}
          <div className="user-chip"><div className="avatar">{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div><div className="user-name">{user.name}</div><div className="user-role">{isDemo ? `${tr(locale, "Demo", "ডেম’")} ${roleLabel(user.role, locale)}` : roleLabel(user.role, locale)}</div></div></div>
        </div>
      </header>
      <main className="content">{isDemo && <div className="demo-banner"><ShieldCheck size={14}/><span><strong>{tr(locale, "Demonstration workspace.", "ডেম’ ৱৰ্কস্পেচ।")}</strong> {tr(locale, "Reports shown here are synthetic and fictional. Sign in with Supabase for private, durable records; connect Gemini for live bilingual analysis.", "ইয়াত দেখুওৱা প্ৰতিবেদনসমূহ কল্পিত। ব্যক্তিগত আৰু স্থায়ী তথ্যৰ বাবে Supabase-ত ছাইন ইন কৰক; প্ৰকৃত দ্বিভাষিক এআই বিশ্লেষণৰ বাবে Gemini সংযোগ কৰক।")}</span></div>}{children}</main>
    </div>
    <nav className={`mobile-bottom-nav role-${user.role}`} aria-label={tr(locale, "Mobile navigation", "ম’বাইল নেভিগেচন")}>{mobileNav.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={pathname === item.href ? "active" : ""}><Icon/><span>{item.label}</span></Link>; })}</nav>
    {selectedReportId && <ReportDetailDialog reportId={selectedReportId} onClose={closeReport}/>}
  </div>;
}
