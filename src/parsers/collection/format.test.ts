import { describe, expect, it } from "vitest";

import { formatField, splitQueryValues } from "./format.ts";

describe("formatField", () => {
  it("returns an empty string for null", () => {
    expect(formatField(null)).toBe("");
  });

  it("returns the value unchanged when it has no special characters", () => {
    expect(formatField("Hello World!")).toBe("Hello World!");
  });

  it("escapes commas and backslashes", () => {
    expect(formatField("Foo, Bar, Baz\\")).toBe(String.raw`Foo\, Bar\, Baz\\`);
  });
});

describe("splitQueryValues", () => {
  it("returns an empty array for an empty query", () => {
    expect(splitQueryValues("")).toStrictEqual([]);
  });

  it("splits on unescaped commas", () => {
    expect(splitQueryValues("a,b,c")).toStrictEqual(["a", "b", "c"]);
  });

  it("treats empty fields as null", () => {
    expect(splitQueryValues("a,,c")).toStrictEqual(["a", null, "c"]);
    expect(splitQueryValues(",")).toStrictEqual([null, null]);
  });

  it("unescapes escaped commas and backslashes", () => {
    expect(
      splitQueryValues(String.raw`Foo\, Bar\, Baz\\,Hello World!`)
    ).toStrictEqual(["Foo, Bar, Baz\\", "Hello World!"]);
  });

  it("round-trips through formatField", () => {
    const values = ["Foo, Bar, Baz\\", "Hello World!", ""];
    const serialised = values.map(formatField).join(",");
    expect(splitQueryValues(serialised)).toStrictEqual([
      ...values.slice(0, 2),
      null,
    ]);
  });
});
