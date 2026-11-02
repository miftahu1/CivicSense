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

export function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const router = useRouter();
  const { user, locale, isAuthenticated, signOut, reports, selectedReportId, closeReport, authReady } = useWorkspace();
  const [sidebarWidth, setSidebarWidth] = useState(244);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const resizingSidebar = useRef(false);
  const collapsed = sidebarWidth <= 100;

  function toggleSidebar() {
    setSidebarWidth((width) => width <= 100 ? 244 : 72);
  }
  function resizeSidebar(event: React.PointerEvent<HTMLDivElement>) {
    if (resizingSidebar.current) setSidebarWidth(event.clientX < 108 ? 72 : Math.max(108, Math.min(380, event.clientX)));
  }
  useEffect(() => {
    if (!authReady) return;
    if (!isAuthenticated) { router.replace("/login"); return; }
    if (user.role === "admin" && pathname.startsWith("/app")) router.replace("/admin");
    else if (user.role === "staff" && (pathname.startsWith("/admin") || pathname === "/app")) router.replace("/staff");
    else if (user.role === "student" && (pathname.startsWith("/admin") || pathname.startsWith("/staff"))) router.replace("/app");
  }, [authReady, isAuthenticated, pathname, router, user.role]);
  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    if (selectedReportId) queueMicrotask(closeReport);
  }, [pathname, selectedReportId, closeReport]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey || user.role === "admin" || /INPUT|TEXTAREA|SELECT/.test(target.tagName) || target.isContentEditable) return;
      router.push("/app/new");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, user.role]);
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
    { href: "/admin/diagnostics", label: tr(locale, "AI diagnostics", "এআই পৰীক্ষা"), icon: Activity },
  ];
  const staffNav = [
    { href: "/staff", label: tr(locale, "Assigned work", "দায়িত্ব দিয়া কাম"), icon: ClipboardList },
    { href: "/app/new", label: tr(locale, "Report an issue", "সমস্যা জনাওক"), icon: FilePlus2 },
    { href: "/app/reports", label: tr(locale, "My reports", "মোৰ প্ৰতিবেদন"), icon: Home },
  ];
  const campusNav = user.role === "admin" ? [] : [
    { href: "/app/campus-services", label: tr(locale, "Campus services", "কেম্পাছ সেৱা"), icon: Building2 },
    { href: "/app/activity", label: tr(locale, "Recent activity", "শেহতীয়া কাৰ্যকলাপ"), icon: Activity },
  ];
  const nav = user.role === "admin" ? adminNav : user.role === "staff" ? staffNav : studentNav;
  const pageTitle = [...studentNav, ...staffNav, ...adminNav, ...campusNav].find((item) => item.href === pathname)?.label ?? (pathname.includes("/reports/") ? tr(locale, "Report details", "প্ৰতিবেদনৰ বিৱৰণ") : pathname.startsWith("/staff") ? tr(locale, "Assigned work", "দায়িত্ব দিয়া কাম") : tr(locale, "New report", "নতুন প্ৰতিবেদন"));
  const unread = reports.some((report) => report.reporterId === user.id && report.events.length > 0);
  const mobileNav = nav;

  if (!authReady || !isAuthenticated) return <main className="auth-wrap" lang={locale}><section className="auth-main"><div className="auth-card"><Brand/><div className="section-kicker">{tr(locale, "Secure campus workspace", "সুৰক্ষিত কেম্পাছ ৱৰ্কস্পেচ")}</div><h2>{tr(locale, "Sign in to continue", "আগবাঢ়িবলৈ ছাইন ইন কৰক")}</h2><p>{tr(locale, "Campus reports and team tools are available to authorised accounts.", "কেম্পাছৰ প্ৰতিবেদন আৰু দলীয় সঁজুলি অনুমোদিত একাউণ্টৰ বাবে উপলব্ধ।")}</p><Link className="button button-primary" href="/login">{tr(locale, "Go to sign in", "ছাইন ইনলৈ যাওক")}</Link></div></section></main>;

  return <div className={`workspace ${collapsed ? "sidebar-collapsed" : ""} ${isResizingSidebar ? "sidebar-resizing" : ""}`} lang={locale} style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}>
    <a className="skip-link" href="#main-content">{tr(locale, "Skip to content", "বিষয়বস্তুলৈ যাওক")}</a>
    <aside className="sidebar" aria-label={tr(locale, "Main navigation", "মূল নেভিগেচন")}>
      <div className="sidebar-top"><Brand light href={user.role === "admin" ? "/admin" : "/app"}/><button className="collapse-button" onClick={toggleSidebar} aria-label={collapsed ? tr(locale, "Expand sidebar", "কাষৰ তালিকা বহল কৰক") : tr(locale, "Collapse sidebar", "কাষৰ তালিকা সৰু কৰক")}>{collapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}</button></div>
      <div className="sidebar-section"><div className="nav-label">{tr(locale, "Workspace", "ৱৰ্কস্পেচ")}</div>{nav.map((item) => {
        const Icon = item.icon; const active = pathname === item.href || (item.href.endsWith("issues") && pathname.startsWith("/admin/issues")) || (item.href === "/app/reports" && pathname.startsWith("/app/reports/"));
        return <Link key={item.href} href={item.href} className={`side-link ${active ? "active" : ""}`} title={item.label} aria-current={active ? "page" : undefined}><Icon size={16}/><span>{item.label}</span></Link>;
      })}</div>
      {campusNav.length > 0 && <div className="sidebar-section"><div className="nav-label">{tr(locale, "Campus", "কেম্পাছ")}</div>{campusNav.map((item) => { const Icon = item.icon; const active = pathname === item.href; return <Link key={item.href} href={item.href} className={`side-link ${active ? "active" : ""}`} title={item.label} aria-current={active ? "page" : undefined}><Icon size={16}/><span>{item.label}</span></Link>; })}</div>}
      {user.role === "admin" && <div className="sidebar-section"><div className="nav-label">{tr(locale, "Administration", "প্ৰশাসন")}</div><Link href="/admin/issues" className="side-link" title={tr(locale, "Review queue", "পৰ্যালোচনাৰ শাৰী")}><ShieldCheck size={16}/><span>{tr(locale, "Review queue", "পৰ্যালোচনাৰ শাৰী")}</span></Link><Link href="/admin/clusters" className="side-link" title={tr(locale, "Manage clusters", "ক্লাষ্টাৰ পৰিচালনা")}><FolderKanban size={16}/><span>{tr(locale, "Manage clusters", "ক্লাষ্টাৰ পৰিচালনা")}</span></Link></div>}
      <div className="sidebar-bottom"><Link href="/" className="help-link"><CircleHelp size={15}/><span>{tr(locale, "About CivicSense", "CivicSense-ৰ বিষয়ে")}</span></Link><div className="demo-mode"><strong><span className="live-dot"/> {tr(locale, "Connected", "সংযুক্ত")}</strong>{tr(locale, "Signed in to your campus workspace.", "আপুনি কেম্পাছৰ ৱৰ্কস্পেচত ছাইন ইন কৰিছে।")}</div></div>
    </aside>
    <div className="sidebar-resize-handle" role="separator" aria-label={tr(locale, "Resize sidebar", "কাষৰ তালিকাৰ আকাৰ সলনি কৰক")} aria-orientation="vertical" aria-valuemin={72} aria-valuemax={380} aria-valuenow={sidebarWidth} tabIndex={0}
      onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); resizingSidebar.current = true; setIsResizingSidebar(true); }}
      onPointerMove={resizeSidebar}
      onPointerUp={(event) => { resizingSidebar.current = false; setIsResizingSidebar(false); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => { resizingSidebar.current = false; setIsResizingSidebar(false); }}
      onDoubleClick={() => setSidebarWidth(244)}
      onKeyDown={(event) => { if (event.key === "ArrowLeft") setSidebarWidth((width) => Math.max(72, width - 16)); if (event.key === "ArrowRight") setSidebarWidth((width) => Math.min(380, width + 16)); }} />
    <div className="main-area">
      <header className="topbar">
        <div className="crumbs"><span>{tr(locale, "Campus operations", "কেম্পাছ পৰিচালনা")}</span><span>›</span><strong>{pageTitle}</strong></div>
        <div className="topbar-actions">
          <LanguageToggle/>
          <button className="icon-button" aria-label={tr(locale, "Notifications", "জাননী")} title={tr(locale, "Recent status updates", "শেহতীয়া স্থিতিৰ আপডেট")} onClick={() => { if (user.role === "admin") { router.push("/admin/issues"); return; } const first = reports.find((report) => report.reporterId === user.id && report.events.length); if (first) router.push(`/app/reports/${first.id}`); }}><Bell size={17}/>{unread && <span className="notification-dot"/>}</button>
          <button className="icon-button" aria-label={tr(locale, "Sign out", "ছাইন আউট")} title={tr(locale, "Sign out", "ছাইন আউট")} onClick={() => void signOut()}><LogOut size={16}/></button>
          <div className="user-chip"><div className="avatar">{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div><div className="user-name">{user.name}</div><div className="user-role">{roleLabel(user.role, locale)}</div></div></div>
        </div>
      </header>
      <main className="content" id="main-content">{children}</main>
    </div>
    <nav className={`mobile-bottom-nav role-${user.role}`} aria-label={tr(locale, "Mobile navigation", "ম’বাইল নেভিগেচন")}>{mobileNav.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={pathname === item.href ? "active" : ""}><Icon/><span>{item.label}</span></Link>; })}</nav>
    {selectedReportId && <ReportDetailDialog reportId={selectedReportId} onClose={closeReport}/>}
  </div>;
}
