import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  ThinkingLevel,
  Type,
} from "@google/genai";
import { reportAnalysisSchema } from "./schemas";
import type { Language } from "./types";

const analysisSystemPrompt = `You are a civic issue tracking assistant for a university in Assam, India. Your role is to analyze student and staff reports, which may be in English, Assamese, or a mix of both (like "Romanised Assamese"). Your analysis must be concise, neutral, and directly relevant to the report. You will provide bilingual titles and summaries, and categorize the issue.

Follow these rules for your JSON output:
- detectedLanguage: accurately detect the primary language of the original text. Valid values are "English", "Assamese", "Romanised Assamese", or "Mixed".
- titleEn/titleAs: create short, descriptive titles in English and Assamese, under 80 characters each.
- summaryEn/summaryAs: write concise, neutral summaries (2-3 sentences) in English and Assamese. If the report is unclear, summarize the available information.
- category: choose the most fitting category from the provided schema.
- priority: assign "Low", "Medium", "High", or "Urgent".
- priorityExplanation: briefly explain the priority choice in one sentence.
- department: suggest the campus department best equipped to handle the issue. Use a generic name if unsure (e.g., "Maintenance Department", "IT Services").
- sensitive: flag as true if the report contains sensitive personal, political, or security information; otherwise, false.
- confidence: rate your analysis confidence from 0.0 to 1.0.
- Do not include an imageDescription; no image is provided for this analysis.`;

const imageAnalysisSystemPrompt =
  "You are a factual image description assistant. Describe the contents of the image in a single, neutral sentence. Do not infer causes or add information that is not visually present.";

const categories = [
  "Infrastructure",
  "Utilities",
  "Safety and Security",
  "Transportation",
  "Environmental",
  "Administrative",
  "Student Life",
  "Faculty Support",
  "Events and Activities",
  "Technology and IT",
  "Health and Wellness",
  "Other",
] as const;

const analysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    detectedLanguage: {
      type: Type.STRING,
      enum: ["English", "Assamese", "Romanised Assamese", "Mixed"],
    },
    category: { type: Type.STRING, enum: [...categories] },
    priority: { type: Type.STRING, enum: ["Low", "Medium", "High", "Urgent"] },
    priorityExplanation: { type: Type.STRING },
    titleEn: { type: Type.STRING },
    titleAs: { type: Type.STRING },
    summaryEn: { type: Type.STRING },
    summaryAs: { type: Type.STRING },
    department: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
    sensitive: { type: Type.BOOLEAN },
  },
  required: [
    "detectedLanguage",
    "category",
    "priority",
    "priorityExplanation",
    "titleEn",
    "titleAs",
    "summaryEn",
    "summaryAs",
    "department",
    "confidence",
    "sensitive",
  ],
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

export type AiCallOptions = {
  model?: string;
  fallbackModel?: string;
  timeoutMs?: number;
  attempts?: number;
  onModelUsed?: (model: string) => void;
};

function errorSummary(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

async function withModelFallback<T>(
  task: string,
  options: AiCallOptions,
  request: (model: string, callOptions: AiCallOptions) => Promise<T>,
): Promise<T> {
  const primaryModel = options.model || process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const fallbackModel = options.fallbackModel || process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite";

  try {
    const result = await request(primaryModel, options);
    options.onModelUsed?.(primaryModel);
    return result;
  } catch (primaryError) {
    if (!fallbackModel || fallbackModel === primaryModel) throw primaryError;

    const fallbackStartedAt = Date.now();
    console.warn("Gemini primary model failed; retrying with fallback", {
      task,
      primaryModel,
      fallbackModel,
      error: errorSummary(primaryError),
    });

    try {
      const fallbackOptions: AiCallOptions = {
        ...options,
        model: fallbackModel,
        fallbackModel: undefined,
        timeoutMs: Math.min(options.timeoutMs ?? 30_000, 30_000),
        attempts: 1,
      };
      const result = await request(fallbackModel, fallbackOptions);
      options.onModelUsed?.(fallbackModel);
      console.info("Gemini fallback model succeeded", {
        task,
        primaryModel,
        fallbackModel,
        durationMs: Date.now() - fallbackStartedAt,
      });
      return result;
    } catch (fallbackError) {
      console.error("Gemini primary and fallback models failed", {
        task,
        primaryModel,
        fallbackModel,
        primaryError: errorSummary(primaryError),
        fallbackError: errorSummary(fallbackError),
        fallbackDurationMs: Date.now() - fallbackStartedAt,
      });
      throw fallbackError;
    }
  }
}

let client: GoogleGenAI | undefined;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on the server.");

  client ??= new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 30_000,
      retryOptions: { attempts: 2 },
    },
  });
  return client;
}

export async function analyzeImage(image: { mimeType: string; bytes: Buffer }, options: AiCallOptions = {}): Promise<string> {
  return withModelFallback("image analysis", options, async (model, callOptions) => {
    const result = await getClient().models.generateContent({
      model,
      contents: [{
        role: "user",
        parts: [{ text: "Describe the visible issue in this image." }, {
          inlineData: { mimeType: image.mimeType, data: image.bytes.toString("base64") },
        }],
      }],
      config: {
        systemInstruction: imageAnalysisSystemPrompt,
        safetySettings,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        httpOptions: {
          timeout: callOptions.timeoutMs ?? 30_000,
          retryOptions: { attempts: callOptions.attempts ?? 2 },
        },
      },
    });

    const description = result.text?.trim();
    if (!description) throw new Error("Gemini returned no image description.");
    return description;
  });
}

export async function analyzeReport(input: { text: string; language?: Language; building: string; area: string; title?: string; category?: string }, options: AiCallOptions = {}) {
  const titleContext = input.title ? `\nSubmitted title/context: ${input.title}` : "";
  const categoryContext = input.category ? `\nReporter-selected category: ${input.category}` : "";
  const languageContext = input.language
    ? ` The reporter's language hint is ${input.language}, but it may be wrong; detect the source language from the report text and prioritize the text itself.`
    : " Detect the source language directly from the report text.";
  const userPrompt = `Analyze the following report from the ${input.building} campus building${input.area ? ` (area: ${input.area})` : ""}.${languageContext}${titleContext}${categoryContext}\n\n${input.text}`;
  return withModelFallback("report analysis", options, async (model, callOptions) => {
    const result = await getClient().models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: analysisSystemPrompt,
        responseMimeType: "application/json",
        responseSchema: analysisResponseSchema,
        safetySettings,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        httpOptions: {
          timeout: callOptions.timeoutMs ?? 30_000,
          retryOptions: { attempts: callOptions.attempts ?? 2 },
        },
      },
    });

    const text = result.text;
    if (!text) throw new Error("Gemini returned no report analysis.");
    return reportAnalysisSchema.parse(JSON.parse(text));
  });
}

export async function embedReport(text: string, building: string, area: string, options: AiCallOptions = {}): Promise<number[]> {
  const content = `task: sentence similarity | query: Location: ${building}, ${area}\n\n${text}`;
  const result = await getClient().models.embedContent({
    model: options.model || process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2",
    contents: content,
    config: {
      outputDimensionality: 768,
      ...(options.timeoutMs ? { httpOptions: { timeout: options.timeoutMs, retryOptions: { attempts: options.attempts ?? 2 } } } : {}),
    },
  });
  const values = result.embeddings?.[0]?.values;
  if (!values?.length) throw new Error("Gemini returned no report embedding.");
  return values;
}
