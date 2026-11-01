/* eslint-disable no-console */
import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import { z } from "zod";
import "dotenv/config";

const model = process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// A basic embedding function using the Google Generative AI SDK
async function embed(text: string | null | undefined): Promise<number[]> {
  if (!text) {
    throw new Error("Attempted to embed an empty or undefined text.");
  }
  const result = await genAI.getGenerativeModel({ model }).embedContent({
    content: { role: "user", parts: [{ text }] },
    taskType: TaskType.SEMANTIC_SIMILARITY,
  });
  return result.embedding.values;
}

// The main schema for the evaluation dataset
const schema = z.object({
  "distractor documents": z.array(z.string()),
  "relevant documents": z.array(z.string()),
  "retrieval query": z.string(),
});

// Function to calculate the dot product of two vectors
function dotProduct(vecA: number[], vecB: number[]): number {
  let product = 0;
  for (let i = 0; i < vecA.length; i++) {
    product += vecA[i] * vecB[i];
  }
  return product;
}

async function main() {
  // Parse the dataset from the JSON file
  const dataset = schema.parse(require("./evaluate-matching-dataset.json"));

  // Embed the retrieval query
  const queryEmbedding = await embed(dataset["retrieval query"]);

  // Embed all distractor documents and calculate their similarity to the query
  const distractorSimilarities = await Promise.all(
    dataset["distractor documents"].map(async (doc) => {
      const docEmbedding = await embed(doc);
      return dotProduct(queryEmbedding, docEmbedding);
    }),
  );

  // Embed all relevant documents and calculate their similarity to the query
  const relevantSimilarities = await Promise.all(
    dataset["relevant documents"].map(async (doc) => {
      const docEmbedding = await embed(doc);
      return dotProduct(queryEmbedding, docEmbedding);
    }),
  );

  // -- Analysis --

  // Find the minimum similarity score among the relevant documents
  const minRelevantSimilarity = Math.min(...relevantSimilarities);

  // Count how many distractor documents have a higher similarity score than the minimum relevant one
  const falsePositives = distractorSimilarities.filter((sim) => sim > minRelevantSimilarity).length;

  // Find the maximum similarity score among the distractor documents
  const maxDistractorSimilarity = Math.max(...distractorSimilarities);

  // Count how many relevant documents have a lower similarity score than the maximum distractor one
  const falseNegatives = relevantSimilarities.filter((sim) => sim < maxDistractorSimilarity).length;

  console.log("--- Matching Evaluation Results ---");
  console.log(`- Model: ${model}`);
  console.log("- Total Documents:", dataset["distractor documents"].length + dataset["relevant documents"].length);
  console.log("- Retrieval Query:", dataset["retrieval query"]);
  console.log("\n--- Similarity Scores ---");
  console.log("- Average Relevant Similarity:", relevantSimilarities.reduce((a, b) => a + b, 0) / relevantSimilarities.length);
  console.log("- Average Distractor Similarity:", distractorSimilarities.reduce((a, b) => a + b, 0) / distractorSimilarities.length);
  console.log("- Min Relevant Similarity:", minRelevantSimilarity);
  console.log("- Max Distractor Similarity:", maxDistractorSimilarity);
  console.log("\n--- Error Analysis ---");
  console.log(
    `- False Positives (distractors more similar than the least relevant doc): ${falsePositives} / ${dataset["distractor documents"].length}`,
  );
  console.log(
    `- False Negatives (relevant docs less similar than the most similar distractor): ${falseNegatives} / ${dataset["relevant documents"].length}`,
  );
  console.log("-------------------------------------");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
