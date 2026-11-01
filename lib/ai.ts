import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory, TaskType } from "@google/generative-ai";
import { z } from "zod";
import { reportAnalysisSchema } from "./schemas";
import type { Language } from "./types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const analysisSystemPrompt = `You are a civic issue tracking assistant for a university in Assam, India. Your role is to analyze student and staff reports, which may be in English, Assamese, or a mix of both (like "Romanised Assamese"). Your analysis must be concise, neutral, and directly relevant to the report. You will provide bilingual titles and summaries, and categorize the issue.\n\nFollow these rules for your JSON output:\n- **detectedLanguage**: Accurately detect the primary language of the original text. Valid values are "English", "Assamese", "Romanised Assamese", or "Mixed".\n- **titleEn/titleAs**: Create short, descriptive titles in English and Assamese, under 80 characters each.\n- **summaryEn/summaryAs**: Write concise, neutral summaries (2-3 sentences) in English and Assamese. If the report is unclear, summarize the available information.\n- **category**: Choose the most fitting category from this list: "Infrastructure", "Utilities", "Safety and Security", "Transportation", "Environmental", "Administrative", "Student Life", "Faculty Support", "Events and Activities", "Technology and IT", "Health and Wellness", "Other".\n- **priority**: Assign a priority: "Low", "Medium", "High", or "Urgent".\n- **priorityExplanation**: Briefly explain your priority choice in one sentence.\n- **department**: Suggest the university department best equipped to handle the issue. Use a generic name if unsure (e.g., "Maintenance Department", "IT Services").\n- **sensitive**: Flag as true if the report contains sensitive personal, political, or security information; otherwise, false.\n- **confidence**: Rate your analysis confidence from 0.0 to 1.0.\n- **imageDescription**: You will not be provided an image. Do not include this field.`;

const imageAnalysisSystemPrompt = `You are a factual image description assistant. Your role is to describe the contents of an image in a single, neutral sentence. Do not interpret, editorialize, or add any information that is not visually present in the image.`;

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

const textModel = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
  generationConfig: { responseMimeType: "application/json" },
  systemInstruction: analysisSystemPrompt,
  safetySettings,
});

const visionModel = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
  systemInstruction: imageAnalysisSystemPrompt,
});

const embeddingModel = genAI.getGenerativeModel({ model: process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004" });


export async function analyzeImage(image: { mimeType: string, bytes: Buffer }): Promise<string> {
  try {
    const result = await visionModel.generateContent([
      { inlineData: { mimeType: image.mimeType, data: image.bytes.toString("base64") } },
    ]);
    return result.response.text();
  } catch (error) {
    console.error("Gemini image analysis failed", { error });
    throw error;
  }
}

export async function analyzeReport(input: { text: string; language: Language; building: string; area: string; }) {
  const userPrompt = `Analyze the following report. It was submitted in ${input.language} from the ${input.building} campus building${input.area ? ` (area: ${input.area})` : ""}.\n\n${input.text}`;

  const result = await textModel.generateContent(userPrompt);
  const text = result.response.text();
  
  const cleanedText = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  const parsed = reportAnalysisSchema.safeParse(JSON.parse(cleanedText));

  if (!parsed.success) {
    console.error("Gemini response validation failed", { error: parsed.error, json: cleanedText });
    throw parsed.error; // ZodError
  }

  return parsed.data;
}

export async function embedReport(text: string, building: string, area: string): Promise<number[]> {
  const result = await embeddingModel.embedContent({
    content: { role: "user", parts: [{ text: `Location: ${building}, ${area}\n\n${text}` }] },
    taskType: TaskType.SEMANTIC_SIMILARITY,
  });
  return result.embedding.values;
}
