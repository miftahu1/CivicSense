"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ReportDetail } from "@/components/report-detail";
import { useWorkspace } from "@/components/workspace-provider";
import { tr } from "@/lib/i18n";

export function ReportDetailDialog({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { locale } = useWorkspace();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);
  return <dialog ref={dialogRef} className="report-dialog" aria-label={tr(locale, "Report details", "প্ৰতিবেদনৰ বিৱৰণ")} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === dialogRef.current) onClose(); }}>
    <div className="report-dialog-toolbar"><span>{tr(locale, "Campus issue record", "কেম্পাছৰ সমস্যাৰ তথ্য")}</span><button type="button" onClick={onClose} autoFocus aria-label={tr(locale, "Close report details", "প্ৰতিবেদনৰ বিৱৰণ বন্ধ কৰক")}><X size={19}/>{tr(locale, "Close", "বন্ধ কৰক")}</button></div>
    <div className="report-dialog-scroll"><ReportDetail reportId={reportId}/></div>
  </dialog>;
}
