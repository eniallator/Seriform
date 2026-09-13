import { describe, expect, it } from "vitest";

import { decodeFrames, encodeFrames } from "./frames.ts";

describe("encodeFrames", () => {
  it("returns an empty string for an empty array", () => {
    expect(encodeFrames([])).toBe("");
  });

  it("produces a base64 length prefix, a delimiter, then the content", () => {
    expect(encodeFrames(["a"])).toBe("A.a");
  });

  it("concatenates one prefixed frame per value, in order", () => {
    expect(encodeFrames(["a", "bb"])).toBe("A.aB.bb");
  });

  it("encodes null and undefined frames as zero-length", () => {
    expect(encodeFrames([null])).toBe(".");
    expect(encodeFrames([undefined])).toBe(".");
  });

  it("nests: a frame's content may itself be an encoded frame sequence", () => {
    expect(encodeFrames([encodeFrames(["x", "y"]), encodeFrames(["z"])])).toBe(
      "F.A.xA.yC.A.z"
    );
  });

  it("encodes null frames as zero-length", () => {
    expect(decodeFrames(encodeFrames([null]))).toStrictEqual([null]);
  });

  it("concatenates multiple frames without needing escaping", () => {
    const frames = ["a,b\\c", "", "hello: world"];
    expect(decodeFrames(encodeFrames(frames))).toStrictEqual([
      "a,b\\c",
      null,
      "hello: world",
    ]);
  });

  it("does not require escaping the delimiter character within content", () => {
    const frames = ["a.b.c", ".", "..."];
    expect(decodeFrames(encodeFrames(frames))).toStrictEqual(frames);
  });
});

describe("decodeFrames", () => {
  it("returns an empty array for an empty string", () => {
    expect(decodeFrames("")).toStrictEqual([]);
  });

  it("reads an explicit length-prefixed frame back out", () => {
    expect(decodeFrames("A.a")).toStrictEqual(["a"]);
  });

  it("reads multiple concatenated frames back out, in order", () => {
    expect(decodeFrames("A.aB.bb")).toStrictEqual(["a", "bb"]);
  });

  it("reads a nested frame sequence back out from a single outer frame", () => {
    const [inner] = decodeFrames("F.A.xA.yC.A.z");
    expect(decodeFrames(inner ?? "")).toStrictEqual(["x", "y"]);
  });

  it("round-trips arbitrary content, including colons and empty strings", () => {
    const frames = ["foo", null, "a:b:c", "", "😀 unicode"];
    expect(decodeFrames(encodeFrames(frames))).toStrictEqual([
      "foo",
      null,
      "a:b:c",
      null,
      "😀 unicode",
    ]);
  });
});
