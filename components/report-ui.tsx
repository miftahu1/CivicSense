import type { Priority, ReportStatus } from "@/lib/types";
import { priorityClass, statusClass } from "@/lib/format";
import { priorityLabel, statusLabel, type InterfaceLanguage } from "@/lib/i18n";

export function StatusPill({ status, language = "en" }: { status: ReportStatus; language?: InterfaceLanguage }) {
  return <span className={`status-pill ${statusClass(status)}`} lang={language}><i className="status-dot"/>{statusLabel(status, language)}</span>;
}

export function PriorityPill({ priority, language = "en" }: { priority: Priority; language?: InterfaceLanguage }) {
  return <span className={`priority-pill ${priorityClass(priority)}`} lang={language}>{priorityLabel(priority, language)}</span>;
}
