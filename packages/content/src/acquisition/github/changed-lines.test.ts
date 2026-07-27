import { createHash } from "node:crypto";
import { ChangedLinesError, reconstructChangedLines } from "./changed-lines";

const testModuleName: string = "vitest";
interface Expectation {
  toBe(expected: unknown): void;
  toBeInstanceOf(expected: unknown): void;
  toEqual(expected: unknown): void;
  toThrow(expected?: unknown): void;
}
interface TestApi {
  describe(name: string, callback: () => unknown): void;
  expect(actual: unknown): Expectation;
  it(name: string, callback: () => unknown): void;
}
const { describe, expect, it } = await import(testModuleName) as TestApi;
const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
const blob = (text: string, suffix: string) => ({
  blobSha: suffix.repeat(40),
  rawSha256: suffix.repeat(64),
  normalizedSha256: sha256(text),
  text,
  kind: "regular" as const,
  binary: false,
});
const base = {
  parentCommits: ["a".repeat(40)],
  changeKind: "modified",
  parentPath: "src/code.ts",
  childPath: "src/code.ts",
  parent: blob("const a = 1;\nconst b = 2;\n", "b"),
  child: blob("const a = 1;\nconst b = 3;\n", "c"),
  displayedPatch: "@@ incomplete or misleading @@",
} as const;

describe("same-path changed-line reconstruction", () => {
  it("derives exact child lines and bounded context from pinned blobs", () => {
    const result = reconstructChangedLines(base);
    expect(result.algorithmVersion).toBe("line-sequence-v1");
    expect(result.changedLines).toEqual([{ line: 2, text: "const b = 3;" }]);
    expect(result.coordinates).toEqual({ startLine: 1, endLine: 3 });
    expect(result.excerpt).toBe("const a = 1;\nconst b = 3;\n");
    expect(result.excerptSha256).toBe(sha256(result.excerpt));
    expect(result.parentRawSha256).toBe(base.parent.rawSha256);
    expect(result.childNormalizedSha256).toBe(base.child.normalizedSha256);
  });

  it("ignores the displayed patch when reconstructing", () => {
    expect(reconstructChangedLines({ ...base, displayedPatch: "first" })).toEqual(
      reconstructChangedLines({ ...base, displayedPatch: "different and truncated" }),
    );
  });

  it("rejects root and merge commits", () => {
    expect(() => reconstructChangedLines({ ...base, parentCommits: [] }))
      .toThrow("SINGLE_PARENT_REQUIRED");
    expect(() => reconstructChangedLines({
      ...base,
      parentCommits: ["a".repeat(40), "d".repeat(40)],
    })).toThrow("SINGLE_PARENT_REQUIRED");
  });

  it("rejects added, deleted, renamed, copied, and type-changed inputs", () => {
    for (const changeKind of ["added", "deleted", "renamed", "copied", "type-changed"]) {
      expect(() => reconstructChangedLines({ ...base, changeKind })).toThrow("CHANGE_KIND_REJECTED");
    }
    expect(() => reconstructChangedLines({ ...base, childPath: "src/other.ts" }))
      .toThrow("SAME_PATH_REQUIRED");
  });

  it("rejects non-regular and binary parent or child blobs", () => {
    expect(() => reconstructChangedLines({
      ...base,
      parent: { ...base.parent, kind: "symlink" },
    })).toThrow("REGULAR_TEXT_REQUIRED");
    expect(() => reconstructChangedLines({
      ...base,
      child: { ...base.child, binary: true },
    })).toThrow("REGULAR_TEXT_REQUIRED");
  });

  it("rejects unchanged blobs", () => {
    expect(() => reconstructChangedLines({ ...base, child: base.parent }))
      .toThrow("UNCHANGED_CONTENT");
  });

  it("rejects changes without eligible executable or declarative child code", () => {
    for (const [path, parentText, childText] of [
      ["src/code.ts", "const x=1;\n", "const x=1;\n// comment only\n"],
      ["src/code.ts", "const x=1;\n", "const x=1;\nimport x from 'dependency';\n"],
      ["src/code.ts", "const x=1;\n", "const x=1;\n   \n"],
      ["docs/code.ts", "const x=1;\n", "const x=2;\n"],
      ["package.json", "{}\n", "{\"x\":1}\n"],
    ] as const) {
      expect(() => reconstructChangedLines({
        ...base,
        parentPath: path,
        childPath: path,
        parent: blob(parentText, "d"),
        child: blob(childText, "e"),
      })).toThrow("NO_ELIGIBLE_CODE_CHANGE");
    }
  });

  it("finds exact child coordinates with repeated lines and reordering", () => {
    const repeated = reconstructChangedLines({
      ...base,
      parent: blob("const a=1;\nrepeat();\nconst b=2;\nrepeat();\n", "d"),
      child: blob("const a=1;\nrepeat();\ninsert();\nconst b=2;\nrepeat();\n", "e"),
    });
    expect(repeated.changedLines).toEqual([{ line: 3, text: "insert();" }]);
    const reordered = reconstructChangedLines({
      ...base,
      parent: blob("a();\nb();\nc();\n", "d"),
      child: blob("a();\nc();\nb();\n", "e"),
    });
    expect(reordered.changedLines).toEqual([{ line: 3, text: "b();" }]);
  });

  it("rejects distant hunks that exceed the bounded excerpt span", () => {
    const parentLines = Array.from({ length: 40 }, (_, index) => `line${index}();`);
    const childLines = [...parentLines];
    childLines[2] = "changedStart();";
    childLines[35] = "changedEnd();";
    expect(() => reconstructChangedLines({
      ...base,
      parent: blob(`${parentLines.join("\n")}\n`, "d"),
      child: blob(`${childLines.join("\n")}\n`, "e"),
    })).toThrow("EXCERPT_SPAN_LIMIT");
  });

  it("rejects inputs beyond the named diff line ceiling", () => {
    const parentText = `${Array.from({ length: 2_001 }, () => "a();").join("\n")}\n`;
    expect(() => reconstructChangedLines({
      ...base,
      parent: blob(parentText, "d"),
      child: blob(`${parentText}changed();\n`, "e"),
    })).toThrow("DIFF_LINE_LIMIT");
  });

  it("uses a non-sensitive specific error type", () => {
    expect(() => reconstructChangedLines({ ...base, parentCommits: [] }))
      .toThrow(ChangedLinesError);
  });
});
