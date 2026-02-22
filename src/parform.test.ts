import { beforeEach, describe, expect, it, vi } from "vitest";

import { Parform } from "./parform.ts";
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

describe("Parform", () => {
  let baseEl: HTMLElement;
  let parform: Parform<TestParserValues>;

  beforeEach(() => {
    baseEl = document.createElement("div");
    parform = new Parform(makeParsers(), baseEl, {
      query: location.search,
    });
  });

  // --- getAllValues ---
  it("getAllValues returns all values", () => {
    expect(parform.getAllValues()).toEqual({
      foo: "parsed",
      bar: null,
    });
  });

  // --- getValue ---
  it("getValue returns the value for a key", () => {
    expect(parform.getValue("foo")).toBe("parsed");
    expect(parform.getValue("bar")).toBe(null);
  });

  // --- setValue ---
  it("setValue updates the value and calls updateValue if type is 'Value'", () => {
    parform.setValue("foo", "newVal");
    expect(parform.getValue("foo")).toBe("newVal");

    parform.setValue("bar", "test");
    expect(parform.getValue("bar")).toBe(null);
  });

  // --- extra getter ---
  it("extra returns undefined if not set", () => {
    expect(parform.extra).toBeUndefined();
  });

  // --- addListener & tellListeners ---
  it("addListener and tellListeners notify listeners", () => {
    const cb = vi.fn();
    parform.addListener(cb);
    parform.tellListeners("foo");
    expect(cb).toHaveBeenCalledWith(parform.getAllValues(), "foo");
  });

  it("addListener with empty subscriptions notifies on any update", () => {
    const cb = vi.fn();

    parform.addListener(cb, []);
    parform.tellListeners("foo");
    expect(cb).toHaveBeenCalled();

    cb.mockClear();
    parform.tellListeners("bar");
    expect(cb).toHaveBeenCalled();
  });

  it("tellListeners only notifies listeners subscribed to the id", () => {
    const cb = vi.fn();
    parform.addListener(cb, ["foo"]);
    parform.tellListeners("bar");
    expect(cb).not.toHaveBeenCalled();

    parform.tellListeners("foo");
    expect(cb).toHaveBeenCalled();
  });

  // --- serialiseToUrlParams ---
  it("serialiseToUrlParams returns correct string", () => {
    const result = parform.serialiseToUrlParams("extraVal");
    expect(result).toBe("foo=serialised&extra=extraVal");
  });

  it("serialiseToUrlParams handles no extra", () => {
    expect(parform.serialiseToUrlParams()).toBe("foo=serialised");
  });
});
