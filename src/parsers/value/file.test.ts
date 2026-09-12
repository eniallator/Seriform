import { raise } from "niall-utils/core";
import { describe, expect, it, vi } from "vitest";

import { fileParser } from "./file.ts";

describe("fileParser", () => {
  const valueA = "foo";
  const valueB = "bar";

  it("creates the input with given attributes and default value", () => {
    const parser = fileParser({
      default: valueA,
      attrs: { "data-hello": "world!" },
    }).methods(vi.fn(), vi.fn());

    const el = parser.html("id", null, false);
    expect(el.tagName).toBe("DIV");
    expect(el.className).toBe("file");
  });

  it("initial state is expected", () => {
    const queryActual = fileParser({ default: valueB }).methods(
      vi.fn(),
      vi.fn(),
      { initial: valueB, default: valueB }
    );
    expect(queryActual.getValue(queryActual.html(null, valueA, true))).toBe(
      valueA
    );

    const initialActual = fileParser({ default: valueB }).methods(
      vi.fn(),
      vi.fn(),
      { initial: valueA, default: valueB }
    );
    expect(initialActual.getValue(initialActual.html(null, null, true))).toBe(
      valueA
    );

    const collDefaultActual = fileParser({ default: valueB }).methods(
      vi.fn(),
      vi.fn(),
      { initial: null, default: valueA }
    );
    expect(
      collDefaultActual.getValue(collDefaultActual.html(null, null, true))
    ).toBe(valueA);

    const defaultActual = fileParser({ default: valueA }).methods(
      vi.fn(),
      vi.fn()
    );
    expect(defaultActual.getValue(defaultActual.html(null, null, false))).toBe(
      valueA
    );

    const actual = fileParser({}).methods(vi.fn(), vi.fn());
    expect(actual.getValue(actual.html(null, null, true))).toBe("");
  });

  it("serialise returns null if value matches default", () => {
    const parser = fileParser({ default: valueA }).methods(
      vi.fn(),
      vi.fn(() => valueA)
    );

    expect(parser.serialise(true)).toBeNull();
  });

  it("serialise returns the current value when it differs from default", () => {
    const parser = fileParser({}).methods(
      vi.fn(),
      vi.fn(() => valueA)
    );

    parser.html(null, valueA, false);

    expect(parser.serialise(false)).toBe(valueA);
  });

  it("updateValue sets the value", () => {
    const parser = fileParser({}).methods(
      vi.fn(),
      vi.fn(() => valueA)
    );

    const el = parser.html(null, valueB, true);
    parser.updateValue(el, true);
    expect(parser.getValue(el)).toBe(valueA);
  });

  it("html sets up onchange handler", async () => {
    const onChange = vi.fn();
    const parser = fileParser({}).methods(onChange, vi.fn());

    const el =
      parser.html(null, null, true).querySelector("input") ??
      raise(new Error("No input found in file html"));

    el.files = [
      new File([valueA], "test.txt", { type: "text/plain" }),
    ] as unknown as FileList;

    await el.onchange?.({} as Event);

    expect(onChange).toHaveBeenCalledWith(valueA);
  });

  it("onchange handler does nothing when no file is selected", async () => {
    const onChange = vi.fn();
    const parser = fileParser({}).methods(onChange, vi.fn());

    const el =
      parser.html(null, null, true).querySelector("input") ??
      raise(new Error("No input found in file html"));

    await el.onchange?.({} as Event);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("clicking the button clicks the hidden file input", () => {
    const parser = fileParser({}).methods(vi.fn(), vi.fn());
    const el = parser.html(null, null, false);

    const input =
      el.querySelector("input") ?? raise(new Error("No input found"));
    const clickSpy = vi.spyOn(input, "click");

    (el.querySelector("button") ?? raise(new Error("No button found"))).click();

    expect(clickSpy).toHaveBeenCalled();
  });
});
