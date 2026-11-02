import { notFound } from "next/navigation";
import { PublicIssueDetails } from "@/components/public-issue-details";
import { isPublicIssueBoardEnabled } from "@/lib/public-issues";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PublicIssuePage() {
  try {
    if (!await isPublicIssueBoardEnabled(createServiceClient())) notFound();
  } catch {
    notFound();
  }
  return <PublicIssueDetails/>;
}
