import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { imageReportDraftSchema } from "@/lib/schemas";

const DRAFT_LIFETIME_MS = 30 * 60 * 1000;

export type ImageReportDraft = {
  userId: string;
  building: string;
  area: string;
  imageHash: string;
  suggestions: ReturnType<typeof imageReportDraftSchema.parse>;
  expiresAt: number;
};

function secret() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Image report drafts require SUPABASE_SERVICE_ROLE_KEY.");
  return value;
}

export function imageFingerprint(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function createImageReportDraft(input: Omit<ImageReportDraft, "expiresAt">) {
  const payload = Buffer.from(JSON.stringify({ ...input, expiresAt: Date.now() + DRAFT_LIFETIME_MS })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyImageReportDraft(token: string): ImageReportDraft | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  let received: Buffer;
  try { received = Buffer.from(signature, "base64url"); } catch { return null; }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ImageReportDraft;
    const suggestions = imageReportDraftSchema.parse(parsed.suggestions);
    if (typeof parsed.userId !== "string" || typeof parsed.building !== "string" || typeof parsed.area !== "string" || typeof parsed.imageHash !== "string" || typeof parsed.expiresAt !== "number" || parsed.expiresAt < Date.now()) return null;
    return { ...parsed, suggestions };
  } catch {
    return null;
  }
}
