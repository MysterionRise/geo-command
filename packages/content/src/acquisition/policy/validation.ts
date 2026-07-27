export type ValidationFailure = (message: string) => never;

export const requireExactText = (
  value: unknown,
  field: string,
  fail: ValidationFailure,
): string => {
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) {
    return fail(`${field} must be a non-blank exact string`);
  }
  return value;
};

export const requireWholeSecondUtc = (
  value: unknown,
  field: string,
  fail: ValidationFailure,
): string => {
  const candidate = requireExactText(value, field, fail);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(candidate)
    || Number.isNaN(Date.parse(candidate))
    || new Date(candidate).toISOString().replace(".000Z", "Z") !== candidate
  ) {
    return fail(`${field} must be whole-second RFC3339 UTC`);
  }
  return candidate;
};
