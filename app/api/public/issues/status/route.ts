import { createServiceClient } from "@/lib/supabase/server";
import { isPublicIssueBoardEnabled } from "@/lib/public-issues";

export async function GET() {
  try {
    const enabled = await isPublicIssueBoardEnabled(createServiceClient());
    return Response.json({ enabled }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Public issue board status could not be read", error);
    return Response.json({ enabled: false }, { headers: { "Cache-Control": "no-store" } });
  }
}
