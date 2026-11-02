import { analyzeImage, analyzeReport, embedReport } from "@/lib/ai";
import { imageContentMatches, imageTypeAllowed } from "@/lib/report-service";
import { categories, type Language } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authErrorResponse, requireAdmin } from "@/lib/supabase/server";

const languages: Language[] = ["English", "Assamese", "Romanised Assamese", "Mixed"];
const allowedModels = /^[a-zA-Z0-9._/-]{1,120}$/;

export async function GET() {
  try {
    await requireAdmin();
    return Response.json({
      analysisModel: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2",
      similarityThreshold: Number(process.env.SIMILARITY_THRESHOLD || "0.82"),
      geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  let admin: SupabaseClient;
  let authDurationMs = 0;
  try {
    ({ admin } = await requireAdmin());
    authDurationMs = Date.now() - requestStartedAt;
  } catch (error) {
    return authErrorResponse(error);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Could not read the diagnostic form." }, { status: 400 });
  }

  const originalText = String(form.get("originalText") || "").trim();
  const title = String(form.get("title") || "").trim();
  const language = String(form.get("language") || "");
  const building = String(form.get("building") || "").trim();
  const area = String(form.get("area") || "").trim();
  const category = String(form.get("category") || "");
  const model = String(form.get("model") || "").trim();
  const embeddingModel = String(form.get("embeddingModel") || "").trim();
  const timeoutMs = Number(form.get("timeoutMs") || 30_000);
  const attempts = Number(form.get("attempts") || 2);
  const imageFile = form.get("image");

  if (originalText.length < 10 || originalText.length > 5000) {
    return Response.json({ error: "Report details must be between 10 and 5,000 characters." }, { status: 400 });
  }
  if (title.length > 120 || area.length > 120 || building.length < 2 || building.length > 120) {
    return Response.json({ error: "Check the title, building, and area lengths." }, { status: 400 });
  }
  if (!languages.includes(language as Language)) return Response.json({ error: "Choose a supported source language." }, { status: 400 });
  if (category && !categories.includes(category as (typeof categories)[number])) return Response.json({ error: "Choose a supported report category." }, { status: 400 });
  if (!allowedModels.test(model) || !allowedModels.test(embeddingModel)) return Response.json({ error: "Enter valid Gemini model IDs." }, { status: 400 });
  if (![10_000, 30_000, 60_000, 120_000].includes(timeoutMs) || ![1, 2, 3].includes(attempts)) {
    return Response.json({ error: "Choose one of the available timeout and retry settings." }, { status: 400 });
  }
  if (imageFile && (!(imageFile instanceof File) || imageFile.size > 15 * 1024 * 1024 || !imageTypeAllowed(imageFile.type))) {
    return Response.json({ error: "Use a JPEG, PNG, WebP, or HEIC image up to 15 MB." }, { status: 415 });
  }

  let image: { mimeType: string; bytes: Buffer } | undefined;
  if (imageFile instanceof File && imageFile.size > 0) {
    const bytes = Buffer.from(await imageFile.arrayBuffer());
    if (!imageContentMatches(imageFile.type, bytes)) return Response.json({ error: "The selected file does not match its image type." }, { status: 415 });
    image = { mimeType: imageFile.type, bytes };
  }
  const inputPreparationMs = Date.now() - requestStartedAt - authDurationMs;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      const runStep = async <T,>(name: string, work: () => Promise<T>, displayResult?: (result: T) => unknown) => {
        const startedAt = Date.now();
        send({ type: "step", name, status: "running", elapsedMs: 0 });
        try {
          const result = await work();
          const durationMs = Date.now() - startedAt;
          send({ type: "step", name, status: "complete", durationMs, result: displayResult ? displayResult(result) : result });
          return { ok: true as const, result, durationMs };
        } catch (error) {
          const durationMs = Date.now() - startedAt;
          const message = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
          console.error("AI diagnostics step failed", { step: name, durationMs, error });
          send({ type: "step", name, status: "failed", durationMs, error: message });
          return { ok: false as const, error: message, durationMs };
        }
      };

      void (async () => {
        send({
          type: "started",
          authDurationMs,
          model,
          embeddingModel,
          category,
          timeoutMs,
          attempts,
          inputPreparationMs,
          savedToDatabase: false,
        });

        const dbPing = await runStep("Supabase read check", async () => {
          const { data, error } = await admin.from("reports").select("id").limit(1);
          if (error) throw error;
          return { reachable: true, sampleRowsReturned: data?.length || 0 };
        });

        let actualAnalysisModel = model;
        const [analysis, embedding] = await Promise.all([
          runStep("Gemini report analysis", async () => {
            return analyzeReport({ text: originalText, title, language: language as Language, building, area }, {
              model,
              timeoutMs,
              attempts,
              onModelUsed: (usedModel) => { actualAnalysisModel = usedModel; },
            });
          }, (result) => ({ modelUsed: actualAnalysisModel, analysis: result })),
          runStep("Gemini embedding", async () => {
            const values = await embedReport(originalText, building, area, { model: embeddingModel, timeoutMs, attempts });
            return { dimensions: values.length, preview: values.slice(0, 6).map((value) => Number(value.toFixed(5))), values };
          }, ({ dimensions, preview }) => ({ dimensions, preview })),
        ]);

        if (embedding.ok) {
          const values = embedding.result.values;
          await runStep("Supabase similarity search", async () => {
            const { data, error } = await admin.rpc("match_reports", {
              p_query_embedding: `[${values.join(",")}]`,
              p_exclude_report_id: null,
              p_location_building: building,
              p_threshold: Number(process.env.SIMILARITY_THRESHOLD || "0.82"),
              p_match_count: 3,
            });
            if (error) throw error;
            return (data || []).map((candidate: { report_id: string; similarity: number; cosine_similarity: number; location_match: boolean }) => ({
              reportId: candidate.report_id,
              similarity: candidate.similarity,
              cosineSimilarity: candidate.cosine_similarity,
              locationMatch: candidate.location_match,
            }));
          });
        } else {
          send({ type: "step", name: "Supabase similarity search", status: "skipped", reason: "Embedding step failed." });
        }

        if (image) {
          let actualImageModel = model;
          await runStep("Gemini image analysis", async () => analyzeImage(image!, {
            model,
            timeoutMs,
            attempts,
            onModelUsed: (usedModel) => { actualImageModel = usedModel; },
          }), (description) => ({ modelUsed: actualImageModel, description }));
        } else {
          send({ type: "step", name: "Gemini image analysis", status: "skipped", reason: "No image selected." });
        }

        send({
          type: "finished",
          totalDurationMs: Date.now() - requestStartedAt,
          analysisSucceeded: analysis.ok,
          embeddingSucceeded: embedding.ok,
          databaseSucceeded: dbPing.ok,
          note: "Diagnostic calls do not create, update, or delete campus reports.",
        });
        controller.close();
      })().catch((error) => {
        const message = error instanceof Error ? error.message : "Unexpected diagnostics error.";
        console.error("AI diagnostics stream failed", error);
        send({ type: "fatal", error: message, totalDurationMs: Date.now() - requestStartedAt });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
