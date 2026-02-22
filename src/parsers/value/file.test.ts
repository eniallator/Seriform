import { describe, expect, it, test, vi } from "vitest";

import { fileParser } from "./file.ts";
import { raise } from "niall-utils";

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
    expect(parser.serialise(true)).toBe(null);
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

  test.skip("html sets up onchange handler", ctx => {
    ctx.skip("Can't mock the inputEl.files property");

    const onChange = vi.fn();
    const parser = fileParser({}).methods(onChange, vi.fn());

    const el =
      parser.html(null, null, true).querySelector("input") ??
      raise(new Error("No input found in file html"));

    // el.files = [
    //   new File([valueA], "test.txt", { type: "text/plain" }),
    // ] as FileList;
    const files = Object.create(el.files) as FileList;
    files[0] = new File([valueA], "test.txt", { type: "text/plain" });
    el.files = files;

    el.onchange?.({} as Event);

    expect(onChange).toHaveBeenCalledWith(valueA);
  });
});
