import { parseRunRecord, type RunRecord } from "./model";

export class RunReportError extends Error {
  public constructor() {
    super("RUN_REPORT_REJECTED");
    this.name = "RunReportError";
  }
}

const SENSITIVE_TEXT = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  /https?:\/\/[^\s]*\?[^\s]*/iu,
  /\bbearer\s+\S+/iu,
  /(?:authorization|cookie|password|secret|token|credential|x-amz-(?:signature|security-token))\s*[:=]\s*\S+/iu,
] as const;

const rejectSensitiveValues = (value: unknown, seen = new Set<object>()): void => {
  if (typeof value === "string") {
    if (SENSITIVE_TEXT.some((pattern) => pattern.test(value))) throw new RunReportError();
    return;
  }
  if (typeof value !== "object" || value === null) return;
  if (seen.has(value)) throw new RunReportError();
  seen.add(value);
  for (const nested of Object.values(value)) rejectSensitiveValues(nested, seen);
  seen.delete(value);
};

export const parseRunReport = (value: unknown): RunRecord => {
  rejectSensitiveValues(value);
  return parseRunRecord(value);
};
export const createRunReport = (value: unknown): RunRecord => parseRunReport(value);
