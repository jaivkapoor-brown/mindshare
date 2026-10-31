import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalJson, commitHash, sha256Hex } from "../src";

describe("commit-reveal", () => {
  it("sha256 matches node crypto", () => {
    for (const s of ["", "abc", "x".repeat(1000), "héllo 🐸 judge"]) {
      expect(sha256Hex(s)).toBe(createHash("sha256").update(s).digest("hex"));
    }
  });
  it("canonical json sorts keys", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 1, e: 0 }] } })).toBe('{"a":{"c":[3,{"e":0,"f":1}],"d":2},"b":1}');
  });
  it("verifies the revealed persona and fails for a tampered one", () => {
    const persona = { name: "Judge X", voice: "gruff", loves: { id: "dogs" } };
    const commit = commitHash(persona, "seed");
    expect(commitHash({ ...persona }, "seed")).toBe(commit);
    expect(commitHash({ ...persona, loves: { id: "cats" } }, "seed")).not.toBe(commit);
    expect(commitHash(persona, "seed2")).not.toBe(commit);
  });
});
