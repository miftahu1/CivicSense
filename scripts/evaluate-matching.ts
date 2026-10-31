import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { expectedMatches, expectedNonMatches, matchingCases } from "../test-data/assamese-matching-cases";

const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error("Set GEMINI_API_KEY before running the cross-language evaluation.");
const client = new GoogleGenAI({ apiKey: key });
const model = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2";

async function main() {
  const vectors = new Map<string, number[]>();
  for (const item of matchingCases) {
    const response = await client.models.embedContent({ model, contents: `Campus location: ${item.building}; ${item.area}. Original complaint: ${item.text}`, config: { outputDimensionality: 768 } });
    const values = response.embeddings?.[0]?.values;
    if (!values || values.length !== 768) throw new Error(`${item.id}: expected a 768-dimensional embedding.`);
    vectors.set(item.id, values);
  }
  const lookup = new Map(matchingCases.map((item) => [item.id, item]));
  const cosine = (a: number[], b: number[]) => { let dot=0, aa=0, bb=0; for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];} return dot/(Math.sqrt(aa)*Math.sqrt(bb)); };
  const threshold = Number(process.env.SIMILARITY_THRESHOLD || "0.82");
  let failures = 0;
  const show = (pair: [string,string], expected: boolean) => {
    const left=lookup.get(pair[0])!,right=lookup.get(pair[1])!;
    const raw=cosine(vectors.get(left.id)!,vectors.get(right.id)!);
    const score=Math.min(1,raw+(left.building.toLocaleLowerCase()===right.building.toLocaleLowerCase()?0.025:0));
    const actual=score>=threshold;
    if(actual!==expected) failures++;
    console.log(`${actual===expected?"PASS":"FAIL"} ${left.id} ↔ ${right.id} expected ${expected?"match":"separate"}; cosine=${raw.toFixed(3)}, location-adjusted=${score.toFixed(3)}, threshold=${threshold.toFixed(2)}`);
  };
  console.log("Cross-language semantic evaluation (keep all original reports separate until a person confirms a relationship)\n");
  expectedMatches.forEach((pair)=>show(pair,true));
  expectedNonMatches.forEach((pair)=>show(pair,false));
  if(failures) { console.error(`\n${failures} evaluation case(s) did not meet the current threshold. Review scores and calibrate SIMILARITY_THRESHOLD before relying on automatic suggestions.`); process.exitCode=1; }
  else console.log("\nAll prepared match and non-match cases passed at the configured threshold.");
}
void main();
