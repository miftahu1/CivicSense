import { analyzeImageReportDraft } from "@/lib/ai";
import { createImageReportDraft, imageFingerprint } from "@/lib/image-report-draft";
import { imageContentMatches, imageTypeAllowed } from "@/lib/report-service";
import { authErrorResponse, requireUser } from "@/lib/supabase/server";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const form = await request.formData();
    const file = form.get("image");
    const building = String(form.get("building") || "").trim();
    const area = String(form.get("area") || "").trim();
    if (!building || building.length < 2 || building.length > 120) return Response.json({ error: "Choose a campus building or area." }, { status: 400 });
    if (area.length > 120) return Response.json({ error: "The location detail is too long." }, { status: 400 });
    if (!(file instanceof File) || !file.size) return Response.json({ error: "Upload a photo to continue." }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return Response.json({ error: "Images must be 15 MB or smaller." }, { status: 413 });
    if (!imageTypeAllowed(file.type)) return Response.json({ error: "Use a JPEG, PNG, WebP, or HEIC image." }, { status: 415 });
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!imageContentMatches(file.type, bytes)) return Response.json({ error: "The selected file does not match its image type." }, { status: 415 });

    const suggestions = await analyzeImageReportDraft({ mimeType: file.type, bytes }, { building, area });
    const token = createImageReportDraft({ userId: user.id, building, area, imageHash: imageFingerprint(bytes), suggestions });
    return Response.json({ token, ...suggestions }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      console.error("Image report draft signing is not configured", error);
      return Response.json({ error: "Image-first reporting is temporarily unavailable. Contact the campus administrator." }, { status: 503 });
    }
    console.error("Image-first report analysis failed", error);
    return authErrorResponse(error);
  }
}
