export type UnknownRecord = Record<string, unknown>;

export function requireObject(value: unknown, field: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value as UnknownRecord;
}

export function requireExact(
  record: UnknownRecord,
  fields: readonly string[],
  prefix = "",
): void {
  const extra = Object.keys(record).find((field) => !fields.includes(field));
  if (extra) throw new TypeError(`unexpected field ${prefix}${extra}`);
}

export function requireSection(
  root: UnknownRecord,
  field: string,
  fields: readonly string[],
): UnknownRecord {
  const value = requireObject(root[field], field);
  requireExact(value, fields, `${field}.`);
  return value;
}

export function requireText(
  record: UnknownRecord,
  field: string,
  prefix = "",
): string {
  const value = record[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${prefix}${field} must be a non-blank string`);
  }
  return value;
}

export function requireStringList(
  record: UnknownRecord,
  field: string,
  prefix = "",
): readonly string[] {
  const value = record[field];
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${prefix}${field} must be a non-empty string list`);
  }
  return Object.freeze(value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new TypeError(`${prefix}${field}[${index}] must be a non-blank string`);
    }
    return entry;
  }));
}

export function requireMatch(
  record: UnknownRecord,
  field: string,
  pattern: RegExp,
  prefix = "",
): string {
  const value = requireText(record, field, prefix);
  if (!pattern.test(value)) {
    throw new TypeError(`${prefix}${field} has an invalid immutable value`);
  }
  return value;
}

export const requireGitSha = (
  record: UnknownRecord,
  field: string,
  prefix: string,
): string => requireMatch(record, field, /^[0-9a-f]{40}$/u, prefix);

export const requireSha256 = (
  record: UnknownRecord,
  field: string,
  prefix: string,
): string => requireMatch(record, field, /^[0-9a-f]{64}$/u, prefix);

export const requireInstant = (
  record: UnknownRecord,
  field: string,
  prefix: string,
): string => requireMatch(
  record,
  field,
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u,
  prefix,
);
