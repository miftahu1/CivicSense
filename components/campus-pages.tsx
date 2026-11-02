"use client";

import Link from "next/link";
import { Activity, ArrowRight, Building2, FilePlus2, HeartPulse, Layers3, Lightbulb, MapPin, Network, Recycle, ShieldCheck, Wrench } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PriorityPill, StatusPill } from "@/components/report-ui";
import { categoryLabel, reportTitle, tr } from "@/lib/i18n";
import { timeAgo } from "@/lib/format";
import type { Report } from "@/lib/types";

const serviceAreas = [
  { name: "Facilities & Maintenance", description: "Repairs, plumbing, furniture, buildings and access issues.", descriptionAs: "মেৰামতি, পানীৰ পাইপ, আচবাব, ভৱন আৰু প্ৰৱেশৰ সমস্যা।", icon: Wrench },
  { name: "Electrical Services", description: "Lighting, power supply, wiring and electrical safety.", descriptionAs: "পোহৰ, বিদ্যুৎ যোগান, তাঁৰ আৰু বৈদ্যুতিক সুৰক্ষা।", icon: Lightbulb },
  { name: "IT Services", description: "Campus internet, network access and shared technology.", descriptionAs: "কেম্পাছৰ ইণ্টাৰনেট, নেটৱৰ্ক আৰু প্ৰযুক্তিৰ সমস্যা।", icon: Network },
  { name: "Library Services", description: "Study spaces, library equipment and access concerns.", descriptionAs: "পঢ়া ঠাই, পুথিভঁৰালৰ সঁজুলি আৰু প্ৰৱেশৰ সমস্যা।", icon: Building2 },
  { name: "Sanitation & Waste", description: "Cleanliness, bins, waste collection and shared spaces.", descriptionAs: "পৰিষ্কাৰ-পৰিচ্ছন্নতা, ডাষ্টবিন, আৱৰ্জনা আৰু সাধাৰণ ঠাই।", icon: Recycle },
  { name: "Student Housing", description: "Hostel conditions, room facilities and resident safety.", descriptionAs: "হোষ্টেল, কোঠাৰ সুবিধা আৰু আৱাসীৰ সুৰক্ষা।", icon: Layers3 },
  { name: "Health Services", description: "Health, wellbeing and access to campus support.", descriptionAs: "স্বাস্থ্য, সুস্থতা আৰু কেম্পাছৰ সহায় লাভৰ সমস্যা।", icon: HeartPulse },
];

export function CampusServicesPage() {
  const { locale } = useWorkspace();
  return <>
    <div className="page-heading"><div><div className="section-kicker">{tr(locale, "Campus · Support directory", "কেম্পাছ · সহায় সেৱা")}</div><h1>{tr(locale, "Campus services", "কেম্পাছ সেৱা")}</h1><p>{tr(locale, "Choose the team closest to your concern. CivicSense routes reports using the department assigned by campus administrators.", "আপোনাৰ সমস্যাৰ সৈতে জড়িত দলটো বাছক। কেম্পাছৰ প্ৰশাসকে নিৰ্ধাৰণ কৰা বিভাগলৈ CivicSense-এ প্ৰতিবেদন পঠিয়ায়।")}</p></div><div className="heading-actions"><Link href="/app/new" className="button button-terracotta"><FilePlus2 size={15}/>{tr(locale, "Report an issue", "সমস্যা জনাওক")}</Link></div></div>
    <div className="campus-services-note"><ShieldCheck size={18}/><span>{tr(locale, "Not sure which service applies? Submit the report anyway. Campus staff can route it to the right department.", "কোনটো সেৱা প্ৰযোজ্য নিশ্চিত নহয়? তথাপিও প্ৰতিবেদন দিয়ক। কেম্পাছৰ কৰ্মচাৰীয়ে সঠিক বিভাগলৈ পঠিয়াব পাৰিব।")}</span></div>
    <section className="campus-service-grid" aria-label={tr(locale, "Campus support teams", "কেম্পাছৰ সহায়ক দলসমূহ")}>
      {serviceAreas.map(({ name, description, descriptionAs, icon: Icon }) => <article className="panel campus-service-card" key={name}>
        <div className="campus-service-icon"><Icon size={19}/></div><div className="section-kicker">{tr(locale, "Support area", "সহায়ৰ ক্ষেত্ৰ")}</div><h2>{name}</h2><p>{locale === "as" ? descriptionAs : description}</p><Link href="/app/new">{tr(locale, "Report an issue", "সমস্যা জনাওক")}<ArrowRight size={14}/></Link>
      </article>)}
    </section>
    <section className="panel campus-service-footer"><div><div className="section-kicker">{tr(locale, "Every concern has a place", "প্ৰতিটো সমস্যাৰ বাবে ব্যৱস্থা আছে")}</div><h2>{tr(locale, "Include where it happened and what you noticed.", "ক’ত ঘটিল আৰু আপুনি কি লক্ষ্য কৰিলে লিখক।")}</h2></div><Link href="/app/new" className="button button-primary">{tr(locale, "Start a report", "প্ৰতিবেদন আৰম্ভ কৰক")}<ArrowRight size={14}/></Link></section>
  </>;
}

type RecentEvent = { report: Report; message: string; createdAt: string; status: Report["status"] };

export function RecentActivityPage() {
  const { user, reports, locale } = useWorkspace();
  const visibleReports = reports.filter((report) => report.reporterId === user.id || user.role === "staff" && report.assignedDepartment === user.department);
  const events: RecentEvent[] = visibleReports.flatMap((report) => report.events.map((event) => ({ report, message: event.message, createdAt: event.createdAt, status: event.newStatus || event.oldStatus || report.status })))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return <>
    <div className="page-heading"><div><div className="section-kicker">{tr(locale, "Campus · Report timeline", "কেম্পাছ · প্ৰতিবেদনৰ সময়ৰেখা")}</div><h1>{tr(locale, "Recent activity", "শেহতীয়া কাৰ্যকলাপ")}</h1><p>{tr(locale, "Follow status changes and updates on your reports.", "আপোনাৰ প্ৰতিবেদনৰ স্থিতিৰ সলনি আৰু আপডেটসমূহ অনুসৰণ কৰক।")}</p></div><div className="heading-actions"><Link href="/app/reports" className="button button-outline button-small">{tr(locale, "My reports", "মোৰ প্ৰতিবেদন")}<ArrowRight size={14}/></Link></div></div>
    {events.length ? <section className="panel recent-activity-panel"><div className="recent-activity-heading"><Activity size={18}/><div><strong>{tr(locale, "Report updates", "প্ৰতিবেদনৰ আপডেট")}</strong><span>{events.length} {tr(locale, "updates", "টা আপডেট")}</span></div></div><ol className="recent-activity-list">{events.map((event, index) => <li key={`${event.report.id}-${event.createdAt}-${index}`}>
      <span className="recent-activity-marker" aria-hidden="true"/><div className="recent-activity-content"><div className="recent-activity-top"><span>{event.report.ticketNumber} · {timeAgo(event.createdAt, locale)}</span><StatusPill status={event.status} language={locale}/></div><h2>{reportTitle(event.report, locale)}</h2><p>{event.message}</p><div className="recent-activity-meta"><span><MapPin size={13}/>{event.report.building}{event.report.area ? ` · ${event.report.area}` : ""}</span><span>{categoryLabel(event.report.category, locale)}</span><PriorityPill priority={event.report.confirmedPriority || event.report.suggestedPriority} language={locale}/></div><Link href={`/app/reports/${event.report.id}`}>{tr(locale, "Open report", "প্ৰতিবেদন খোলক")}<ArrowRight size={13}/></Link></div>
    </li>)}</ol></section> : <section className="panel empty-state recent-activity-empty"><Activity size={24}/><h2>{tr(locale, "No updates yet", "এতিয়াও কোনো আপডেট নাই")}</h2><p>{tr(locale, "When a campus team updates one of your reports, the change will appear here.", "কেম্পাছৰ দলে আপোনাৰ প্ৰতিবেদন আপডেট কৰিলে ইয়াত দেখা যাব।")}</p><Link href="/app/reports" className="button button-outline button-small">{tr(locale, "View my reports", "মোৰ প্ৰতিবেদন চাওক")}<ArrowRight size={13}/></Link></section>}
  </>;
}
