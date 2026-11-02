import { notFound } from "next/navigation";
import { PublicIssuesBoard } from "@/components/public-issues-board";
import { isPublicIssueBoardEnabled } from "@/lib/public-issues";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PublicIssuesPage() {
  try {
    if (!await isPublicIssueBoardEnabled(createServiceClient())) notFound();
  } catch {
    notFound();
  }
  return <PublicIssuesBoard/>;
}
