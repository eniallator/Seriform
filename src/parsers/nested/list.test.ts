import { describe, expect, it, vi } from "vitest";

import { encodeArray } from "../../encoding.ts";
import { checkboxParser, textParser } from "../value/index.ts";
import { listParser } from "./list.ts";

describe("listParser", () => {
  const field = textParser({});
  const getListValue = (listEl: HTMLElement) =>
    [...listEl.querySelectorAll("ul li").values()].map(
      row => (row.querySelector('input[type="text"]') as HTMLInputElement).value
    );

  const valueA: string[] = ["Foo, Bar, Baz\\", "Hello World!"];
  const valueASerialised = encodeArray(valueA.map(v => encodeArray([v])));
  const valueB: string[] = ["Test", "Other"];

  it("renders one <li> per item, wrapping the field's own html", () => {
    const el = listParser({ default: valueA, field })
      .methods({ id: null, onChange: vi.fn(), getValue: vi.fn() })
      .html("id", null, false);

    expect(getListValue(el)).toStrictEqual(valueA);
  });

  it("deserialises a query string into items via the field's own parsing", () => {
    const el = listParser({ field, default: valueB })
      .methods({ id: null, onChange: vi.fn(), getValue: vi.fn() })
      .html("id", valueASerialised, false);

    expect(getListValue(el)).toStrictEqual(valueA);
  });

  it("getValue reads current values back from the rendered <li> DOM", () => {
    const parser = listParser({ field, default: valueA }).methods({
      id: null,
      onChange: vi.fn(),
      getValue: vi.fn(),
    });
    const el = parser.html("id", null, false);

    expect(parser.getValue(el)).toStrictEqual(valueA);

    const expandableParser = listParser({
      field,
      default: valueA,
      expandable: true,
    }).methods({ id: null, onChange: vi.fn(), getValue: vi.fn() });
    const expandableEl = expandableParser.html("id", null, false);
    expect(expandableParser.getValue(expandableEl)).toStrictEqual(valueA);
  });

  it("serialise array-encodes each item's own serialise output", () => {
    const parser = listParser({
      field: checkboxParser({}),
      default: [true, false],
    }).methods({
      id: null,
      onChange: vi.fn(),
      getValue: vi.fn(() => [false, true]),
    });
    parser.html("id", null, false);

    expect(parser.serialise(true)).toBe(
      encodeArray([encodeArray(["0"]), encodeArray(["1"])])
    );
    expect(parser.serialise(false)).toBe(
      encodeArray([encodeArray(["false"]), encodeArray(["true"])])
    );
  });

  it("array-encodes an item as null when its own value matches its own default", () => {
    const parser = listParser({
      field: checkboxParser({}),
      default: [true, false],
    }).methods({
      id: null,
      onChange: vi.fn(),
      getValue: vi.fn(() => [true, true]),
    });
    parser.html("id", null, false);

    expect(parser.serialise(false)).toBe(
      encodeArray([encodeArray([null]), encodeArray(["true"])])
    );
  });

  it("expandable add/delete keep the rendered <li> DOM in sync", () => {
    const added = listParser({ field, default: valueA, expandable: true })
      .methods({ id: null, onChange: vi.fn(), getValue: vi.fn() })
      .html("id", null, false);
    (
      added.querySelector("button[data-action=add]") as HTMLButtonElement
    ).click();
    expect(getListValue(added)).toStrictEqual([...valueA, ""]);

    const deleted = listParser({ field, default: valueA, expandable: true })
      .methods({
        id: null,
        onChange: vi.fn(),
        getValue: vi.fn(() => valueA),
      })
      .html("id", null, false);
    (
      deleted.querySelector("input[data-selector]") as HTMLInputElement
    ).checked = true;
    (
      deleted.querySelector("button[data-action=delete]") as HTMLButtonElement
    ).click();
    expect(getListValue(deleted)).toStrictEqual(valueA.slice(1));
  });

  it("editing a rendered field's input updates the corresponding item", () => {
    const onChange = vi.fn();
    const parser = listParser({ field, default: valueA }).methods({
      id: null,
      onChange,
      getValue: vi.fn(() => valueA),
    });
    const el = parser.html("id", null, false);

    const firstInput = el.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    firstInput.value = "Changed";
    firstInput.onchange?.({} as Event);

    expect(onChange).toHaveBeenCalledWith(["Changed", valueA[1]]);
  });
});
