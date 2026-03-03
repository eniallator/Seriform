import { describe, expect, it, vi } from "vitest";

import { checkboxParser, textParser } from "../value/index.ts";
import { listParser } from "./list.ts";

describe("listParser", () => {
  const field = textParser({});
  const getListValue = (listEl: HTMLElement) =>
    [...listEl.querySelectorAll("ul li").values()].map(
      row => (row.querySelector('input[type="text"]') as HTMLInputElement).value
    );

  const valueA: string[] = ["Foo, Bar, Baz\\", "Hello World!"];
  const valueASerialised = String.raw`Foo\, Bar\, Baz\\,Hello World!`;
  const valueAShort = String.raw`Foo\, Bar\, Baz\\,Hello World!`;
  const valueB: string[] = ["Test", "Other"];

  it("creates the input with given attributes and default value", () => {
    const parser = listParser({
      default: valueA,
      field,
      attrs: { "data-hello": "world!" },
    }).methods(vi.fn(), vi.fn());

    const el = parser.html("id", null, false);

    expect(el.tagName).toBe("DIV");
    expect(getListValue(el)).toStrictEqual(valueA);
    expect(el.getAttribute("id")).toBe("id");
    expect(el.dataset.hello).toBe("world!");
  });

  it("initial state is expected", () => {
    expect(
      getListValue(
        listParser({ field, default: valueB })
          .methods(vi.fn(), vi.fn())
          .html("id", valueASerialised, false)
      )
    ).toStrictEqual(valueA);

    expect(
      getListValue(
        listParser({ field, default: valueA })
          .methods(vi.fn(), vi.fn())
          .html("id", null, false)
      )
    ).toStrictEqual(valueA);

    expect(
      listParser({ field, default: valueA })
        .methods(vi.fn(), vi.fn())
        .html("id", null, false)
        .querySelector(".actions")
    ).toBeNull();

    expect(
      getListValue(
        listParser({ field, default: [], expandable: true })
          .methods(vi.fn(), vi.fn())
          .html("id", valueASerialised, false)
      )
    ).toStrictEqual(valueA);

    expect(
      listParser({ field, default: [], expandable: true })
        .methods(vi.fn(), vi.fn())
        .html("id", null, false)
        .querySelector(".actions")
    ).not.toBeNull();
  });

  it("expandable lists let you add rows", () => {
    const el = listParser({ field, default: valueA, expandable: true })
      .methods(vi.fn(), vi.fn())
      .html("id", null, false);

    (el.querySelector("button[data-action=add]") as HTMLButtonElement).click();

    expect(getListValue(el)).toStrictEqual([...valueA, ""]);
  });

  it("expandable lists let you delete rows", () => {
    const el = listParser({ field, default: valueA, expandable: true })
      .methods(
        vi.fn(),
        vi.fn(() => valueA)
      )
      .html("id", null, false);

    (el.querySelector("input[data-selector]") as HTMLInputElement).checked =
      true;

    (
      el.querySelector("button[data-action=delete]") as HTMLButtonElement
    ).click();

    expect(getListValue(el)).toStrictEqual(valueA.slice(1));
  });

  it("serialise returns correct value for shortUrl", () => {
    const parser = listParser({
      field: checkboxParser({}),
      default: [true, false],
    }).methods(
      vi.fn(),
      vi.fn(() => [false, true])
    );

    parser.html("id", null, false);

    expect(parser.serialise(true)).toBe("0,1");
    expect(parser.serialise(false)).toBe("false,true");
  });

  it("html deserialises shortUrl properly", () => {
    const parser = listParser({ field, default: valueB }).methods(
      vi.fn(),
      vi.fn()
    );

    expect(getListValue(parser.html("id", valueAShort, true))).toStrictEqual(
      valueA
    );
    expect(
      getListValue(parser.html("id", valueASerialised, false))
    ).toStrictEqual(valueA);
  });

  it("serialise returns null if value matches default", () => {
    const parser = listParser({ field, default: valueA }).methods(
      vi.fn(),
      vi.fn(() => valueA)
    );

    expect(parser.serialise(false)).toBe(null);
  });

  it("updateValue sets the value", () => {
    const parser = listParser({ field, default: valueB }).methods(
      vi.fn(),
      vi.fn(() => valueA)
    );
    const el = parser.html("id", null, false);

    parser.updateValue(el, false);
    expect(getListValue(el)).toStrictEqual(valueA);
  });
});
