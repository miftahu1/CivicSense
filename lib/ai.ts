import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { reportAnalysisSchema } from "@/lib/schemas";
import type { Language } from "@/lib/types";

const outputSchema = {
  type: Type.OBJECT,
  properties: {
    detectedLanguage: { type: Type.STRING, enum: ["English", "Assamese", "Romanised Assamese", "Mixed"] },
    category: { type: Type.STRING, enum: ["Water supply / plumbing", "Electrical", "Internet / network", "Sanitation / waste", "Classroom infrastructure", "Furniture", "Hostel facilities", "Library facilities", "Canteen", "Medical facilities", "Other"] },
    priority: { type: Type.STRING, enum: ["Low", "Medium", "High", "Urgent"] },
    priorityExplanation: { type: Type.STRING },
    titleEn: { type: Type.STRING }, titleAs: { type: Type.STRING },
    summaryEn: { type: Type.STRING }, summaryAs: { type: Type.STRING },
    department: { type: Type.STRING }, imageDescription: { type: Type.STRING },
    confidence: { type: Type.NUMBER }, sensitive: { type: Type.BOOLEAN },
  },
  required: ["detectedLanguage", "category", "priority", "priorityExplanation", "titleEn", "titleAs", "summaryEn", "summaryAs", "department", "imageDescription", "confidence", "sensitive"],
};

function getClient() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

export async function analyzeReport(input: { text: string; language: Language; building: string; area: string; image?: { mimeType: string; bytes: Buffer } }) {
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{
    text: `You triage campus facilities reports for a bilingual university. Read the original exactly as written; it may be native Assamese, Romanised Assamese, English, or mixed. Do not translate away the original meaning. Do not infer facts, causes, injury, or urgency that are not stated or visible. Make the Assamese summary natural Assamese in Assamese script, even if the input is Romanised. Use the image only for visible evidence. Return concise structured JSON matching the schema.\n\nUser indicated language: ${input.language}\nBuilding: ${input.building}\nArea: ${input.area || "Not provided"}\nOriginal report: ${input.text}`,
  }];
  if (input.image) parts.push({ inlineData: { mimeType: input.image.mimeType, data: input.image.bytes.toString("base64") } });
  const result = await getClient().models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    contents: [{ role: "user", parts }],
    config: { responseMimeType: "application/json", responseSchema: outputSchema, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
  });
  const parsed = reportAnalysisSchema.parse(JSON.parse(result.text || ""));
  return parsed;
}

export async function embedReport(text: string, building: string, area: string) {
  const result = await getClient().models.embedContent({
    model: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2",
    contents: `Campus location: ${building}; ${area || "area unspecified"}. Original complaint: ${text}`,
    config: { outputDimensionality: 768 },
  });
  const values = result.embeddings?.[0]?.values;
  if (!values || values.length !== 768) throw new Error("Gemini returned an embedding with an unexpected dimension.");
  return values;
}
