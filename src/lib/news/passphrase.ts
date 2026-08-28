import { timingSafeEqual } from "node:crypto";

const ENV_NAME = "SIGNAL_SUMMARY_PASSPHRASE";

export function hasSummaryPassphrase(): boolean {
  return Boolean(process.env[ENV_NAME]?.trim());
}

export function verifySummaryPassphrase(input: unknown): boolean {
  const expected = String(process.env[ENV_NAME] ?? "")
    .normalize("NFKC")
    .trim();
  const provided = String(input ?? "")
    .normalize("NFKC")
    .trim();
  if (!expected || !provided) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
