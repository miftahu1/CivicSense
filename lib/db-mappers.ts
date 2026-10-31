import type { IssueCluster, Report, ReportEvent, ReportStatus } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbReport = {
  id: string; ticket_number: string; reporter_id: string; reporter_name?: string; original_text: string;
  original_language: Report["originalLanguage"]; title_en: string | null; title_as: string | null;
  summary_en: string | null; summary_as: string | null; category: Report["category"];
  suggested_priority: Report["suggestedPriority"]; confirmed_priority: Report["suggestedPriority"] | null;
  priority_explanation: string | null; department: string | null; location_building: string; location_area: string;
  status: ReportStatus; cluster_id: string | null; assigned_to: string | null; assigned_to_name: string | null; assigned_department?: string | null;
  sensitive_flag: boolean; analysis_status: Report["analysisStatus"]; analysis_confidence: number | null;
  analysis_error: string | null; is_synthetic: boolean; created_at: string; updated_at: string;
};
type DbEvent = { id: string; report_id: string; actor_id: string | null; actor_name: string | null; old_status: ReportStatus | null; new_status: ReportStatus | null; message: string; created_at: string };
type DbAttachment = { report_id: string; storage_path: string; image_caption: string | null };

export function mapEvent(row: DbEvent, actorName?: string): ReportEvent {
  return { id: row.id, actor: actorName || row.actor_name || "Campus operations", oldStatus: row.old_status, newStatus: row.new_status, message: row.message, createdAt: row.created_at };
}

export function mapReport(row: DbReport, options: { reporterName?: string; events?: ReportEvent[]; imageUrl?: string; imageCaption?: string } = {}): Report {
  return {
    id: row.id, ticketNumber: row.ticket_number, reporterId: row.reporter_id, reporterName: options.reporterName || row.reporter_name || "Campus community member",
    originalText: row.original_text, originalLanguage: row.original_language,
    summaryEn: row.summary_en || "Bilingual analysis is pending.", summaryAs: row.summary_as || "দ্বিভাষিক বিশ্লেষণৰ অপেক্ষাত।",
    titleEn: row.title_en || row.original_text.slice(0, 72), titleAs: row.title_as || "বিশ্লেষণৰ অপেক্ষাত",
    category: row.category, suggestedPriority: row.suggested_priority, confirmedPriority: row.confirmed_priority,
    priorityExplanation: row.priority_explanation || "Awaiting review.", building: row.location_building, area: row.location_area || "",
    status: row.status, clusterId: row.cluster_id, assignedTo: row.assigned_to_name || row.assigned_to || null, assignedDepartment: row.assigned_department || null,
    department: row.department || "Awaiting analysis", sensitive: Boolean(row.sensitive_flag), analysisStatus: row.analysis_status, analysisConfidence: row.analysis_confidence ?? null, analysisError: row.analysis_error ?? null, isSynthetic: Boolean(row.is_synthetic),
    createdAt: row.created_at, updatedAt: row.updated_at, imageUrl: options.imageUrl, imageCaption: options.imageCaption,
    events: options.events || [],
  };
}

export function mapCluster(row: { id:string; title:string; category:Report["category"]; location:string; status:ReportStatus; assigned_to?:string|null; assigned_to_name?:string|null; created_at:string }, reportIds: string[] = []): IssueCluster {
  return { id: row.id, title: row.title, category: row.category, location: row.location, status: row.status, assignedTo: row.assigned_to_name || row.assigned_to || null, reportIds, createdAt: row.created_at };
}

export async function loadReports(admin: SupabaseClient, rows: DbReport[]) {
  if (!rows.length) return [] as Report[];
  const ids = rows.map((row) => row.id);
  const reporterIds = [...new Set(rows.map((row) => row.reporter_id))];
  const [eventsResult, attachmentsResult, profilesResult] = await Promise.all([
    admin.from("report_events").select("*").in("report_id", ids).order("created_at", { ascending: true }),
    admin.from("attachments").select("*").in("report_id", ids),
    admin.from("profiles").select("id,full_name").in("id", reporterIds),
  ]);
  const events = (eventsResult.data || []) as DbEvent[];
  const attachments = (attachmentsResult.data || []) as DbAttachment[];
  const profiles = (profilesResult.data || []) as Array<{ id:string; full_name:string }>;
  const profileNames = new Map(profiles.map((profile)=>[profile.id,profile.full_name]));
  const eventsByReport = new Map<string, ReportEvent[]>();
  events.forEach((event)=>{const list=eventsByReport.get(event.report_id)||[];list.push(mapEvent(event,event.actor_name||(event.actor_id?profileNames.get(event.actor_id):undefined)));eventsByReport.set(event.report_id,list);});
  const attachmentByReport = new Map(attachments.map((attachment)=>[attachment.report_id,attachment]));
  const signed = await Promise.all(attachments.map(async(attachment)=>{
    const {data}=await admin.storage.from("report-attachments").createSignedUrl(attachment.storage_path,3600);
    return [attachment.report_id,data?.signedUrl] as const;
  }));
  const imageUrls = new Map(signed.filter((item):item is readonly [string,string]=>Boolean(item[1])));
  return rows.map((row)=>{
    const attachment=attachmentByReport.get(row.id);
    return mapReport(row,{reporterName:profileNames.get(row.reporter_id),events:eventsByReport.get(row.id)||[],imageUrl:imageUrls.get(row.id),imageCaption:attachment?.image_caption||undefined});
  });
}
