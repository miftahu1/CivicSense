
import { analyzeReport, embedReport } from '../lib/ai';
import type { Language } from '../lib/types';

const report = {
  text: 'Library t kitap komkoi thokar babe oxubidha hoise',
  language: 'Romanised Assamese' as Language,
  building: 'Central Library',
  area: 'L2',
};

async function runLocalTest() {
  console.log("--- Running Local Gemini Performance Test ---");
  console.log(`Report Text: "${report.text}"`);
  console.log(`Location: ${report.building} · ${report.area}`);
  console.log("---------------------------------------------\n");

  // --- Test Analysis and Translation ---
  console.time("Analysis & Translation");
  try {
    const analysisResult = await analyzeReport({
      text: report.text,
      language: report.language,
      building: report.building,
      area: report.area,
    });
    console.timeEnd("Analysis & Translation");
    console.log("\nAnalysis Result:", JSON.stringify(analysisResult, null, 2));
  } catch (error) {
    console.timeEnd("Analysis & Translation");
    console.error("\nAnalysis failed:", error);
  }

  console.log("\n---------------------------------------------\n");

  // --- Test Embedding ---
  console.time("Embedding");
  try {
    const embeddingResult = await embedReport(
      report.text,
      report.building,
      report.area
    );
    console.timeEnd("Embedding");
    console.log(`\nEmbedding successful. Vector dimension: ${embeddingResult.length}`);
  } catch (error) {
    console.timeEnd("Embedding");
    console.error("\nEmbedding failed:", error);
  }

  console.log("\n--- Test Complete ---");
}

runLocalTest();
