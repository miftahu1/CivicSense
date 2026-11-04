import { createClient } from "@supabase/supabase-js";
import { notifyDepartmentForReport } from "@/lib/emailjs";

async function main() {
  const reportId = process.argv[2];
  if (!reportId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reportId)) {
    throw new Error("Pass the report UUID: npm run email:resend -- <report-id>");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");

  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const result = await notifyDepartmentForReport(admin, reportId);
  if (result.status === "sent") {
    console.log(`Sent department alert for ${reportId}: ${result.department}, ${result.recipientCount} recipient(s).`);
    return;
  }
  if (result.status === "partial") {
    console.error(`Partially sent department alert for ${reportId}: ${result.sentCount} sent, ${result.failedCount} failed. First error: ${result.message}`);
    process.exitCode = 1;
    return;
  }

  const detail = result.status === "skipped" ? result.reason : result.message;
  throw new Error(`No email sent (${result.status}): ${detail}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
