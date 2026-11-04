import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeDepartment } from "@/lib/departments";

function emailConfig() {
  const config = { serviceId: process.env.EMAILJS_SERVICE_ID, publicKey: process.env.EMAILJS_PUBLIC_KEY, privateKey: process.env.EMAILJS_PRIVATE_KEY };
  if (!config.serviceId || !config.publicKey || !config.privateKey) return null;
  return config;
}

export async function sendCivicSenseEmail(templateId: string | undefined, params: Record<string, string>) {
  const config = emailConfig();
  if (!config || !templateId) { console.info("EmailJS not configured; notification skipped."); return false; }
  const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service_id: config.serviceId, template_id: templateId, user_id: config.publicKey, accessToken: config.privateKey, template_params: params }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`EmailJS delivery failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  return true;
}

export type DepartmentEmailResult =
  | { status: "sent"; department: string; recipientCount: number }
  | { status: "partial"; department: string; sentCount: number; failedCount: number; message: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; message: string };

export async function notifyDepartmentForReport(admin: SupabaseClient, reportId: string): Promise<DepartmentEmailResult> {
  try {
    const { data: report, error } = await admin.from("reports").select("id,ticket_number,title_en,summary_en,original_text,category,suggested_priority,confirmed_priority,department,assigned_department,location_building,location_area,sensitive_flag").eq("id", reportId).maybeSingle();
    if (error) throw error;
    if (!report) return { status: "skipped", reason: "Report not found." };
    if (report.sensitive_flag) return { status: "skipped", reason: "Sensitive reports are not emailed." };
    if (!["High", "Urgent"].includes(report.confirmed_priority || report.suggested_priority)) return { status: "skipped", reason: "Only High or Urgent reports trigger department email." };
    const department = normalizeDepartment(report.assigned_department || report.department);
    if (!department) return { status: "skipped", reason: "The report has no assigned or suggested department." };
    const { data: staff, error: staffError } = await admin.from("profiles").select("id,department,full_name").eq("role", "staff");
    if (staffError) throw staffError;
    const recipientIds = (staff || []).filter((member) => normalizeDepartment(member.department) === department).map((member) => member.id);
    if (!recipientIds.length) return { status: "skipped", reason: `No staff are assigned to ${department}.` };
    const recipients: string[] = [];
    for (let page = 1; page <= 10; page += 1) {
      const { data, error: usersError } = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (usersError) throw usersError;
      for (const user of data.users) if (recipientIds.includes(user.id) && user.email) recipients.push(user.email);
      if (data.users.length < 100 || recipientIds.every((id) => data.users.some((user) => user.id === id))) break;
    }
    if (!recipients.length) return { status: "skipped", reason: `No matching ${department} staff account has an email address.` };
    const priority = report.confirmed_priority || report.suggested_priority;
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const issueUrl = `${appUrl}/app/reports/${report.id}`;
    const uniqueRecipients = [...new Set(recipients)];
    let sentCount = 0;
    let failedCount = 0;
    let firstFailure = "";
    for (const [index, recipient] of uniqueRecipients.entries()) {
      try {
        const sent = await sendCivicSenseEmail(process.env.EMAILJS_DEPARTMENT_ALERT_TEMPLATE_ID, {
          to_email: recipient, department_name: department, priority, ticket_number: report.ticket_number,
          issue_title: report.title_en || `${report.category} issue`, issue_summary: report.summary_en || report.original_text,
          category: report.category, location: [report.location_building, report.location_area].filter(Boolean).join(" · "),
          issue_url: issueUrl, app_name: "CivicSense",
        });
        if (!sent) return { status: "skipped", reason: "EmailJS is not configured or the department alert template ID is missing." };
        sentCount += 1;
      } catch (error) {
        failedCount += 1;
        const message = error instanceof Error ? error.message : "Unknown EmailJS delivery failure.";
        firstFailure ||= message;
        console.error("Department email delivery failed for one recipient; continuing with the rest", { reportId, department, error });
      }
      // EmailJS documents a limit of one REST send request per second.
      if (index < uniqueRecipients.length - 1) await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    if (sentCount === 0) return { status: "failed", message: firstFailure || "No department emails were delivered." };
    if (failedCount > 0) {
      console.warn("Department email notifications partially sent", { reportId, department, sentCount, failedCount });
      return { status: "partial", department, sentCount, failedCount, message: firstFailure };
    }
    console.info("High-priority department email notifications sent", { reportId, department, recipientCount: sentCount });
    return { status: "sent", department, recipientCount: sentCount };
  } catch (error) {
    console.error("Department email notification failed", { reportId, error });
    return { status: "failed", message: error instanceof Error ? error.message : "Unknown EmailJS delivery failure." };
  }
}
