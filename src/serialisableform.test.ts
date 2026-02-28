import { beforeEach, describe, expect, it, vi } from "vitest";

import { SerialisableForm } from "./serialisableform.ts";
import { contentParser, createParsers, valueParser } from "./create.ts";

import type { InitParserObject } from "./types.ts";

const makeParsers = () =>
  createParsers({
    foo: valueParser(
      () => ({
        html: vi.fn(() => document.createElement("input")),
        getValue: vi.fn(() => "parsed"),
        updateValue: vi.fn(),
        serialise: vi.fn(() => "serialised"),
      }),
      "Foo",
      "Foo Title"
    ),
    bar: contentParser(
      () => document.createElement("button"),
      "Bar",
      "Bar Title"
    ),
  });

type TestParserValues =
  ReturnType<typeof makeParsers> extends InitParserObject<infer T> ? T : never;

describe("SerialisableForm", () => {
  let baseEl: HTMLElement;
  let seriform: SerialisableForm<TestParserValues>;

  beforeEach(() => {
    baseEl = document.createElement("div");
    seriform = new SerialisableForm(makeParsers(), baseEl, {
      query: location.search,
    });
  });

  // --- getAllValues ---
  it("getAllValues returns all values", () => {
    expect(seriform.getAllValues()).toEqual({
      foo: "parsed",
      bar: null,
    });
  });

  // --- getValue ---
  it("getValue returns the value for a key", () => {
    expect(seriform.getValue("foo")).toBe("parsed");
    expect(seriform.getValue("bar")).toBe(null);
  });

  // --- setValue ---
  it("setValue updates the value and calls updateValue if type is 'Value'", () => {
    seriform.setValue("foo", "newVal");
    expect(seriform.getValue("foo")).toBe("newVal");

    seriform.setValue("bar", "test");
    expect(seriform.getValue("bar")).toBe(null);
  });

  // --- extra getter ---
  it("extra returns undefined if not set", () => {
    expect(seriform.extra).toBeUndefined();
  });

  // --- extra getter ---
  it("extra returns a custom value if set", () => {
    const seriform = new SerialisableForm(makeParsers(), baseEl, {
      query: "extra=extraVal",
    });
    expect(seriform.extra).toBe("extraVal");
  });

  // --- addListener & tellListeners ---
  it("addListener and tellListeners notify listeners", () => {
    const cb = vi.fn();
    seriform.addListener(cb);
    seriform.tellListeners("foo");
    expect(cb).toHaveBeenCalledWith(seriform.getAllValues(), "foo");
  });

  it("addListener with empty subscriptions notifies on any update", () => {
    const cb = vi.fn();

    seriform.addListener(cb, []);
    seriform.tellListeners("foo");
    expect(cb).toHaveBeenCalled();

    cb.mockClear();
    seriform.tellListeners("bar");
    expect(cb).toHaveBeenCalled();
  });

  it("tellListeners only notifies listeners subscribed to the id", () => {
    const cb = vi.fn();
    seriform.addListener(cb, ["foo"]);
    seriform.tellListeners("bar");
    expect(cb).not.toHaveBeenCalled();

    seriform.tellListeners("foo");
    expect(cb).toHaveBeenCalled();
  });

  // --- serialiseToUrlParams ---
  it("serialiseToUrlParams returns correct string", () => {
    const result = seriform.serialiseToUrlParams("extraVal");
    expect(result).toBe("foo=serialised&extra=extraVal");
  });

  it("serialiseToUrlParams handles no extra", () => {
    expect(seriform.serialiseToUrlParams()).toBe("foo=serialised");
  });
});
