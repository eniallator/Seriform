import { describe, expect, it } from "vitest";

import {
  decodeArray,
  decodeRecord,
  encodeArray,
  encodeRecord,
} from "./encoding.ts";

describe("encodeArrays", () => {
  it("returns an empty string for an empty array", () => {
    expect(encodeArray([])).toBe("");
  });

  it("produces a base64 length prefix, a delimiter, then the content", () => {
    expect(encodeArray(["a"])).toBe("A.a");
  });

  it("concatenates one prefixed array per value, in order", () => {
    expect(encodeArray(["a", "bb"])).toBe("A.aB.bb");
  });

  it("encodes null and undefined arrays as zero-length", () => {
    expect(encodeArray([null])).toBe(".");
    expect(encodeArray([undefined])).toBe(".");
  });

  it("nests: a array's content may itself be an encoded array sequence", () => {
    expect(encodeArray([encodeArray(["x", "y"]), encodeArray(["z"])])).toBe(
      "F.A.xA.yC.A.z"
    );
  });

  it("encodes null arrays as zero-length", () => {
    expect(decodeArray(encodeArray([null]))).toStrictEqual([null]);
  });

  it("concatenates multiple arrays without needing escaping", () => {
    const arrays = ["a,b\\c", "", "hello: world"];
    expect(decodeArray(encodeArray(arrays))).toStrictEqual([
      "a,b\\c",
      null,
      "hello: world",
    ]);
  });

  it("does not require escaping the delimiter character within content", () => {
    const arrays = ["a.b.c", ".", "..."];
    expect(decodeArray(encodeArray(arrays))).toStrictEqual(arrays);
  });
});

describe("decodeArrays", () => {
  it("returns an empty array for an empty string", () => {
    expect(decodeArray("")).toStrictEqual([]);
  });

  it("reads an explicit length-prefixed array back out", () => {
    expect(decodeArray("A.a")).toStrictEqual(["a"]);
  });

  it("reads multiple concatenated arrays back out, in order", () => {
    expect(decodeArray("A.aB.bb")).toStrictEqual(["a", "bb"]);
  });

  it("reads a nested array sequence back out from a single outer array", () => {
    const [inner] = decodeArray("F.A.xA.yC.A.z");
    expect(decodeArray(inner ?? "")).toStrictEqual(["x", "y"]);
  });

  it("round-trips arbitrary content, including colons and empty strings", () => {
    const arrays = ["foo", null, "a:b:c", "", "😀 unicode"];
    expect(decodeArray(encodeArray(arrays))).toStrictEqual([
      "foo",
      null,
      "a:b:c",
      null,
      "😀 unicode",
    ]);
  });
});

describe("encodeRecord", () => {
  it("returns an empty string for an empty record", () => {
    expect(encodeRecord({})).toBe("");
  });

  it("produces a key array followed by a value array", () => {
    expect(encodeRecord({ k: "v" })).toBe("A.kA.v");
  });

  it("concatenates one key/value array pair per entry, in insertion order", () => {
    expect(encodeRecord({ a: "1", bb: "22" })).toBe("A.aA.1B.bbB.22");
    expect(encodeRecord({ bb: "22", a: "1" })).toBe("B.bbB.22A.aA.1");
  });

  it("encodes null and undefined values as zero-length", () => {
    expect(encodeRecord({ k: null })).toBe("A.k.");
    expect(encodeRecord({ k: undefined })).toBe("A.k.");
  });

  it("does not require escaping the delimiter character within keys or values", () => {
    const record = { "a.b.c": ".", ".": "..." };
    expect(decodeRecord(encodeRecord(record))).toStrictEqual(record);
  });
});

describe("decodeRecord", () => {
  it("returns an empty object for an empty string", () => {
    expect(decodeRecord("")).toStrictEqual({});
  });

  it("reads a key/value array pair back out", () => {
    expect(decodeRecord("A.kA.v")).toStrictEqual({ k: "v" });
  });

  it("reads multiple concatenated entries back out, keyed by name", () => {
    expect(decodeRecord("A.aA.1B.bbB.22")).toStrictEqual({ a: "1", bb: "22" });
  });

  it("round-trips an empty-string key back to an empty string, not null", () => {
    expect(decodeRecord(encodeRecord({ "": "value" }))).toStrictEqual({
      "": "value",
    });
  });

  it("does not depend on an external key list - each key is read from the string", () => {
    expect(
      decodeRecord(encodeRecord({ name: "Alice", active: "true" }))
    ).toStrictEqual({ name: "Alice", active: "true" });
  });

  it("decodes to an equivalent record regardless of the order entries were encoded in", () => {
    const forwards = encodeRecord({ x: "1", y: "2", z: "3" });
    const backwards = encodeRecord({ z: "3", y: "2", x: "1" });

    expect(forwards).not.toBe(backwards);
    expect(decodeRecord(forwards)).toStrictEqual({ x: "1", y: "2", z: "3" });
    expect(decodeRecord(backwards)).toStrictEqual({ x: "1", y: "2", z: "3" });
  });

  it("round-trips arbitrary values, including colons, empty strings, and unicode", () => {
    const record = {
      foo: "foo",
      bar: null,
      baz: "a:b:c",
      qux: "",
      emoji: "😀 unicode",
    };
    expect(decodeRecord(encodeRecord(record))).toStrictEqual({
      foo: "foo",
      bar: null,
      baz: "a:b:c",
      qux: null,
      emoji: "😀 unicode",
    });
  });
});
