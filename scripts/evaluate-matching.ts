
import { GoogleGenerativeAI } from "@google/generative-ai";
import { matchingCases, expectedMatches, expectedNonMatches } from "../test-data/assamese-matching-cases";

const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error("Set GEMINI_API_KEY before running the cross-language evaluation.");
const genAI = new GoogleGenerativeAI(key);
const model = process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";

// Create a lookup map for easy access to text by ID
const casesById = new Map(matchingCases.map(c => [c.id, c.text]));

async function embed(text: string): Promise<number[]> {
  if (!text) {
    throw new Error("Attempted to embed an empty or undefined text.");
  }
  const result = await genAI.getGenerativeModel({ model }).embedContent({
    content: { parts: [{ text }] },
    taskType: "SEMANTIC_SIMILARITY",
  });
  return result.embedding.values;
}

function cosineSimilarity(vecA: number[], vecB: number[]) {
  const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
  const magB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
  return dotProduct / (magA * magB);
}

async function runEvaluation() {
  console.log(`Running evaluation with embedding model: ${model}\n`);

  console.log("--- EXPECTED MATCHES ---");
  for (const [id1, id2] of expectedMatches) {
    const text1 = casesById.get(id1);
    const text2 = casesById.get(id2);

    if (!text1 || !text2) {
        console.error(`Could not find text for IDs: ${id1}, ${id2}`);
        continue;
    }

    const [embedding1, embedding2] = await Promise.all([embed(text1), embed(text2)]);
    const similarity = cosineSimilarity(embedding1, embedding2);
    console.log(`[${id1} vs ${id2}] Similarity: ${similarity.toFixed(4)}`);
  }

  console.log("\n--- EXPECTED NON-MATCHES ---");
  for (const [id1, id2] of expectedNonMatches) {
    const text1 = casesById.get(id1);
    const text2 = casesById.get(id2);

    if (!text1 || !text2) {
        console.error(`Could not find text for IDs: ${id1}, ${id2}`);
        continue;
    }
    
    const [embedding1, embedding2] = await Promise.all([embed(text1), embed(text2)]);
    const similarity = cosineSimilarity(embedding1, embedding2);
    console.log(`[${id1} vs ${id2}] Similarity: ${similarity.toFixed(4)}`);
  }
}

runEvaluation().catch(console.error);
