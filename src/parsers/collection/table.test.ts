import { tuple } from "niall-utils";
import { describe, expect, it, vi } from "vitest";

import { numberParser, checkboxParser, textParser } from "../value/index.ts";
import { tableParser } from "./table.ts";

describe("tableParser", () => {
  const fields = tuple(
    checkboxParser({ attrs: { field: null } }),
    textParser({}),
    numberParser({})
  );
  const getTableValue = (tableEl: HTMLElement) =>
    [...tableEl.querySelectorAll("tbody tr").values()].map(row => [
      (row.querySelector('input[type="checkbox"][field]') as HTMLInputElement)
        .checked,
      (row.querySelector('input[type="text"]') as HTMLInputElement).value,
      Number(
        (row.querySelector('input[type="number"]') as HTMLInputElement).value
      ),
    ]);

  const valueA: [boolean, string, number][] = [
    [true, "Foo, Bar, Baz\\", 10],
    [false, "quux & other", -1],
  ];
  const valueASerialised = String.raw`true,Foo\, Bar\, Baz\\,10,false,quux & other,-1`;
  const valueAShort = String.raw`1,Foo\, Bar\, Baz\\,10,0,quux & other,-1`;
  const valueB: [boolean, string, number][] = [
    [false, "Test", 20],
    [true, "Hello World!", 30],
  ];

  it("creates the input with given attributes and default value", () => {
    const parser = tableParser({
      default: valueA,
      fields,
      attrs: { "data-hello": "world!" },
    }).methods(vi.fn(), vi.fn());

    const el = parser.html("id", null, false);

    expect(el.tagName).toBe("DIV");
    expect(getTableValue(el)).toStrictEqual(valueA);
    expect(el.getAttribute("id")).toBe("id");
    expect(el.dataset.hello).toBe("world!");
  });

  it("initial state is expected", () => {
    expect(
      getTableValue(
        tableParser({ fields, default: valueB })
          .methods(vi.fn(), vi.fn())
          .html("id", valueASerialised, false)
      )
    ).toStrictEqual(valueA);

    expect(
      getTableValue(
        tableParser({ fields, default: valueA })
          .methods(vi.fn(), vi.fn())
          .html("id", null, false)
      )
    ).toStrictEqual(valueA);

    expect(
      tableParser({ fields, default: valueA })
        .methods(vi.fn(), vi.fn())
        .html("id", null, false)
        .querySelector(".actions")
    ).toBeNull();

    expect(
      getTableValue(
        tableParser({ fields, default: [], expandable: true })
          .methods(vi.fn(), vi.fn())
          .html("id", valueASerialised, false)
      )
    ).toStrictEqual(valueA);

    expect(
      tableParser({ fields, default: [], expandable: true })
        .methods(vi.fn(), vi.fn())
        .html("id", null, false)
        .querySelector(".actions")
    ).not.toBeNull();
  });

  it("expandable tables let you add rows", () => {
    const el = tableParser({ fields, default: valueA, expandable: true })
      .methods(vi.fn(), vi.fn())
      .html("id", null, false);

    (el.querySelector("button[data-action=add]") as HTMLButtonElement).click();

    expect(getTableValue(el)).toStrictEqual([...valueA, [false, "", 0]]);
  });

  it("expandable tables let you delete rows", () => {
    const el = tableParser({ fields, default: valueA, expandable: true })
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

    expect(getTableValue(el)).toStrictEqual(valueA.slice(1));
  });

  it("serialise returns correct value for shortUrl", () => {
    const parser = tableParser({ fields, default: valueB }).methods(
      vi.fn(),
      vi.fn(() => valueA)
    );

    parser.html("id", null, false);

    expect(parser.serialise(true)).toBe(valueAShort);
    expect(parser.serialise(false)).toBe(valueASerialised);
  });

  it("html deserialises shortUrl properly", () => {
    const parser = tableParser({ fields, default: valueB }).methods(
      vi.fn(),
      vi.fn()
    );

    expect(getTableValue(parser.html("id", valueAShort, true))).toStrictEqual(
      valueA
    );
    expect(
      getTableValue(parser.html("id", valueASerialised, false))
    ).toStrictEqual(valueA);
  });

  it("serialise returns null if value matches default", () => {
    const parser = tableParser({ fields, default: valueA }).methods(
      vi.fn(),
      vi.fn(() => valueA)
    );

    expect(parser.serialise(false)).toBe(null);
  });

  it("updateValue sets the value", () => {
    const parser = tableParser({ fields, default: valueB }).methods(
      vi.fn(),
      vi.fn(() => valueA)
    );
    const el = parser.html("id", null, false);

    parser.updateValue(el, false);
    expect(getTableValue(el)).toStrictEqual(valueA);
  });
});
