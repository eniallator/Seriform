import { tuple } from "niall-utils";
import { describe, expect, it, vi } from "vitest";

import { checkboxParser, numberParser, textParser } from "../value/index.ts";
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

  it("renders one <tr> per item, each field in its own <td>", () => {
    const el = tableParser({ default: valueA, fields })
      .methods(vi.fn(), vi.fn())
      .html("id", null, false);

    expect(getTableValue(el)).toStrictEqual(valueA);
  });

  it("deserialises a flattened query string into rows, chunked by field count", () => {
    const el = tableParser({ fields, default: valueB })
      .methods(vi.fn(), vi.fn())
      .html("id", valueASerialised, false);

    expect(getTableValue(el)).toStrictEqual(valueA);
  });

  it("getValue reads current field values back from the DOM, honoring the row-select offset", () => {
    const parser = tableParser({ fields, default: valueA }).methods(
      vi.fn(),
      vi.fn()
    );
    const el = parser.html("id", null, false);
    expect(parser.getValue(el)).toStrictEqual(valueA);

    const expandableParser = tableParser({
      fields,
      default: valueA,
      expandable: true,
    }).methods(vi.fn(), vi.fn());
    const expandableEl = expandableParser.html("id", null, false);
    expect(expandableParser.getValue(expandableEl)).toStrictEqual(valueA);
  });

  it("serialise joins each row's fields, then joins rows, using each field's own serialise", () => {
    const parser = tableParser({ fields, default: valueB }).methods(
      vi.fn(),
      vi.fn(() => valueA)
    );
    parser.html("id", null, false);

    expect(parser.serialise(true)).toBe(valueAShort);
    expect(parser.serialise(false)).toBe(valueASerialised);
  });

  it("expandable add/delete keep the rendered <tr><td> DOM in sync", () => {
    const added = tableParser({ fields, default: valueA, expandable: true })
      .methods(vi.fn(), vi.fn())
      .html("id", null, false);
    (
      added.querySelector("button[data-action=add]") as HTMLButtonElement
    ).click();
    expect(getTableValue(added)).toStrictEqual([...valueA, [false, "", 0]]);

    const deleted = tableParser({ fields, default: valueA, expandable: true })
      .methods(
        vi.fn(),
        vi.fn(() => valueA)
      )
      .html("id", null, false);
    (
      deleted.querySelector("input[data-selector]") as HTMLInputElement
    ).checked = true;
    (
      deleted.querySelector("button[data-action=delete]") as HTMLButtonElement
    ).click();
    expect(getTableValue(deleted)).toStrictEqual(valueA.slice(1));
  });

  it("editing a rendered field's input updates just that field within its row", () => {
    const onChange = vi.fn();
    const parser = tableParser({ fields, default: valueA }).methods(
      onChange,
      vi.fn(() => valueA)
    );
    const el = parser.html("id", null, false);

    const firstTextInput = el.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    firstTextInput.value = "Changed";
    firstTextInput.onchange?.({} as Event);

    const [checked, , num] = valueA[0] ?? [false, "", 0];
    expect(onChange).toHaveBeenCalledWith([
      [checked, "Changed", num],
      valueA[1],
    ]);
  });
});
