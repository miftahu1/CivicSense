import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeDepartment } from "@/lib/departments";

function emailConfig() {
  const config = { serviceId: process.env.EMAILJS_SERVICE_ID, publicKey: process.env.EMAILJS_PUBLIC_KEY, privateKey: process.env.EMAILJS_PRIVATE_KEY };
  if (!config.serviceId || !config.publicKey || !config.privateKey) return null;
  return config;
}

export async function sendCivicSenseEmail(templateId: string | undefined, params: Record<string, string>) {
  const config = emailConfig();
  if (!config || !templateId) { console.info("EmailJS not configured; notification skipped."); return; }
  const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service_id: config.serviceId, template_id: templateId, user_id: config.publicKey, accessToken: config.privateKey, template_params: params }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`EmailJS delivery failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
}

export async function notifyDepartmentForReport(admin: SupabaseClient, reportId: string) {
  try {
    const { data: report, error } = await admin.from("reports").select("id,ticket_number,title_en,summary_en,original_text,category,suggested_priority,confirmed_priority,department,assigned_department,location_building,location_area,sensitive_flag").eq("id", reportId).maybeSingle();
    if (error) throw error;
    if (!report || report.sensitive_flag || !["High", "Urgent"].includes(report.confirmed_priority || report.suggested_priority)) return;
    const department = normalizeDepartment(report.assigned_department || report.department);
    if (!department) return;
    const { data: staff, error: staffError } = await admin.from("profiles").select("id,department,full_name").eq("role", "staff");
    if (staffError) throw staffError;
    const recipientIds = (staff || []).filter((member) => normalizeDepartment(member.department) === department).map((member) => member.id);
    if (!recipientIds.length) return;
    const recipients: string[] = [];
    for (let page = 1; page <= 10; page += 1) {
      const { data, error: usersError } = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (usersError) throw usersError;
      for (const user of data.users) if (recipientIds.includes(user.id) && user.email) recipients.push(user.email);
      if (data.users.length < 100 || recipientIds.every((id) => data.users.some((user) => user.id === id))) break;
    }
    if (!recipients.length) return;
    const priority = report.confirmed_priority || report.suggested_priority;
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const issueUrl = `${appUrl}/app/reports/${report.id}`;
    for (const recipient of [...new Set(recipients)]) await sendCivicSenseEmail(process.env.EMAILJS_DEPARTMENT_ALERT_TEMPLATE_ID, {
      to_email: recipient, department_name: department, priority, ticket_number: report.ticket_number,
      issue_title: report.title_en || `${report.category} issue`, issue_summary: report.summary_en || report.original_text,
      category: report.category, location: [report.location_building, report.location_area].filter(Boolean).join(" · "),
      issue_url: issueUrl, app_name: "CivicSense",
    });
    console.info("High-priority department email notifications sent", { reportId, department, recipientCount: recipients.length });
  } catch (error) { console.error("Department email notification failed", { reportId, error }); }
}
