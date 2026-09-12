import { raise } from "niall-utils/core";
import { describe, expect, it, vi } from "vitest";

import {
  collectionParser,
  type CollectionAdapter,
  type CollectionConfig,
} from "./base.ts";

/**
 * The row "handle" mirrors what a real Parser exposes: `el` to read the rendered DOM value from (used
 * by `getValues`, matching `Parser.getValue(el)`), and `getValue` to read the *captured* live value
 * (used by `serialiseRow`, matching `Parser.serialise()` which never reads the DOM).
 */
interface FakeRow {
  el: HTMLInputElement;
  getValue: () => string;
}

const fakeAdapter = (
  fieldsPerItem: number = 1
): CollectionAdapter<string, FakeRow> => ({
  baseClass: "fake",
  addLabel: "Add",
  deleteLabel: "Delete",
  fieldsPerItem,
  containerSelector: "ul",
  buildContentHtml: () => "<ul></ul>",
  newRow: ({
    queryItems,
    initial,
    defaultValue,
    getValue,
    onChange,
    shortUrl,
  }) => {
    const li = document.createElement("li");

    const selector = document.createElement("input");
    selector.type = "checkbox";
    selector.dataset.selector = "";
    li.appendChild(selector);

    const input = document.createElement("input");
    input.value = queryItems?.[0] ?? initial ?? defaultValue ?? "";
    input.dataset.shortUrl = String(shortUrl);
    input.onchange = () => onChange(input.value);
    li.appendChild(input);

    return [li, { el: input, getValue }];
  },
  getValues: (_baseEl, rows) => rows.map(row => row.el.value),
  serialiseRow: (row, shortUrl) => `${row.getValue()}${shortUrl ? "!" : ""}`,
  isRowSelected: rowEl =>
    (rowEl.querySelector("[data-selector]") as HTMLInputElement).checked,
});

const getRowInputs = (el: HTMLElement): HTMLInputElement[] =>
  [...el.querySelectorAll("ul li")]
    .map(li => li.querySelectorAll("input")[1])
    .filter((input): input is HTMLInputElement => input != null);

const getRowElements = (el: HTMLElement): HTMLLIElement[] => [
  ...el.querySelectorAll<HTMLLIElement>("ul li"),
];

describe("collectionParser", () => {
  const cfg: CollectionConfig<string> = { default: ["a", "b"] };

  it("throws if fieldsPerItem is not greater than 0", () => {
    expect(() =>
      collectionParser<string, FakeRow>(cfg, fakeAdapter(0))
    ).toThrow("fieldsPerItem must be greater than 0, got 0");
  });

  it("builds the wrapper with base class, id, title, and label", () => {
    const parser = collectionParser<string, FakeRow>(
      { default: ["a"], title: "A hint", label: "My Label" },
      fakeAdapter()
    ).methods(vi.fn(), vi.fn());

    const el = parser.html("my-id", null, false);

    expect(el.tagName).toBe("DIV");
    expect(el.getAttribute("id")).toBe("my-id");
    expect(el.className).toBe("fake");
    expect(el.querySelector(".heading")?.getAttribute("title")).toBe("A hint");
    expect(el.querySelector(".label")?.textContent).toBe("My Label");
  });

  it("merges initialCollapsed and a custom attrs class into the wrapper class", () => {
    const parser = collectionParser<string, FakeRow>(
      { default: [], initialCollapsed: true, attrs: { class: "extra" } },
      fakeAdapter()
    ).methods(vi.fn(), vi.fn());

    const el = parser.html(null, null, false);

    expect(el.className).toBe("fake collapsed extra");
  });

  it("clicking the heading toggles the collapsed class", () => {
    const parser = collectionParser<string, FakeRow>(
      cfg,
      fakeAdapter()
    ).methods(vi.fn(), vi.fn());
    const el = parser.html(null, null, false);

    expect(el.classList.contains("collapsed")).toBe(false);
    (el.querySelector(".heading") as HTMLElement).click();
    expect(el.classList.contains("collapsed")).toBe(true);
    (el.querySelector(".heading") as HTMLElement).click();
    expect(el.classList.contains("collapsed")).toBe(false);
  });

  it("renders one row per default item when there's no query", () => {
    const parser = collectionParser<string, FakeRow>(
      cfg,
      fakeAdapter()
    ).methods(vi.fn(), vi.fn());
    const el = parser.html(null, null, false);

    expect(getRowInputs(el).map(input => input.value)).toStrictEqual([
      "a",
      "b",
    ]);
  });

  it("prefers external initial, then external default, then cfg default", () => {
    const withInitial = collectionParser<string, FakeRow>(cfg, fakeAdapter())
      .methods(vi.fn(), vi.fn(), { initial: ["x"], default: ["y"] })
      .html(null, null, false);
    expect(getRowInputs(withInitial).map(input => input.value)).toStrictEqual([
      "x",
    ]);

    const withoutInitial = collectionParser<string, FakeRow>(cfg, fakeAdapter())
      .methods(vi.fn(), vi.fn(), { initial: null, default: ["y"] })
      .html(null, null, false);
    expect(
      getRowInputs(withoutInitial).map(input => input.value)
    ).toStrictEqual(["y"]);
  });

  it("parses the query into rows using fieldsPerItem to chunk", () => {
    const parser = collectionParser<string, FakeRow>(
      cfg,
      fakeAdapter(2)
    ).methods(vi.fn(), vi.fn());

    const el = parser.html(null, "1,2,3,4", false);

    expect(getRowInputs(el).map(input => input.value)).toStrictEqual([
      "1",
      "3",
    ]);
  });

  it("getValue reads current values via adapter.getValues", () => {
    const parser = collectionParser<string, FakeRow>(
      cfg,
      fakeAdapter()
    ).methods(vi.fn(), vi.fn());
    const el = parser.html(null, null, false);

    expect(parser.getValue(el)).toStrictEqual(["a", "b"]);
  });

  it("serialise returns null when the value matches default, else joins serialiseRow", () => {
    const matching = collectionParser<string, FakeRow>(
      cfg,
      fakeAdapter()
    ).methods(
      vi.fn(),
      vi.fn(() => ["a", "b"])
    );
    expect(matching.serialise(false)).toBeNull();

    const differing = collectionParser<string, FakeRow>(
      cfg,
      fakeAdapter()
    ).methods(
      vi.fn(),
      vi.fn(() => ["x", "y"])
    );
    differing.html(null, null, false);
    expect(differing.serialise(false)).toBe("x,y");
    expect(differing.serialise(true)).toBe("x!,y!");
  });

  it("updateValue clears and rebuilds rows from the current value", () => {
    const parser = collectionParser<string, FakeRow>(
      cfg,
      fakeAdapter()
    ).methods(
      vi.fn(),
      vi.fn(() => ["x", "y", "z"])
    );
    const el = parser.html(null, null, false);

    parser.updateValue(el, false);

    expect(getRowInputs(el).map(input => input.value)).toStrictEqual([
      "x",
      "y",
      "z",
    ]);
  });

  it("editing a row calls onChange with that index replaced", () => {
    const onChange = vi.fn();
    const parser = collectionParser<string, FakeRow>(
      cfg,
      fakeAdapter()
    ).methods(
      onChange,
      vi.fn(() => ["a", "b"])
    );
    const el = parser.html(null, null, false);

    const second = getRowInputs(el)[1] ?? raise(new Error("No row found"));
    second.value = "changed";
    second.onchange?.({} as Event);

    expect(onChange).toHaveBeenCalledWith(["a", "changed"]);
  });

  it("deleting selected rows rebuilds survivors with correct, non-stale indices", () => {
    let state = ["a", "b", "c"];
    const onChange = vi.fn((newState: string[]) => {
      state = newState;
    });
    const parser = collectionParser<string, FakeRow>(
      { default: ["x", "y", "z"], expandable: true },
      fakeAdapter()
    ).methods(onChange, () => state);
    const el = parser.html(null, null, false);

    const firstRow = getRowElements(el)[0] ?? raise(new Error("No row found"));
    (firstRow.querySelector("[data-selector]") as HTMLInputElement).checked =
      true;

    (
      el.querySelector("button[data-action=delete]") as HTMLButtonElement
    ).click();

    expect(onChange).toHaveBeenLastCalledWith(["b", "c"]);
    expect(getRowInputs(el).map(input => input.value)).toStrictEqual([
      "b",
      "c",
    ]);

    // The surviving row that used to be at index 1 is now at index 0; editing it
    // must write to index 0, not the stale index 1 it was originally created with.
    const survivor = getRowInputs(el)[0] ?? raise(new Error("No row found"));
    survivor.value = "changed";
    survivor.onchange?.({} as Event);

    expect(onChange).toHaveBeenLastCalledWith(["changed", "c"]);
  });

  it("adding a row appends it and calls onChange with all current values", () => {
    const onChange = vi.fn();
    const parser = collectionParser<string, FakeRow>(
      { default: ["a", "b"], expandable: true },
      fakeAdapter()
    ).methods(
      onChange,
      vi.fn(() => ["a", "b"])
    );
    const el = parser.html(null, null, false);

    (el.querySelector("button[data-action=add]") as HTMLButtonElement).click();

    expect(getRowInputs(el).map(input => input.value)).toStrictEqual([
      "a",
      "b",
      "",
    ]);
    expect(onChange).toHaveBeenCalledWith(["a", "b", ""]);
  });

  it("only renders actions when expandable", () => {
    const notExpandable = collectionParser<string, FakeRow>(cfg, fakeAdapter())
      .methods(vi.fn(), vi.fn())
      .html(null, null, false);
    expect(notExpandable.querySelector(".actions")).toBeNull();

    const expandable = collectionParser<string, FakeRow>(
      { ...cfg, expandable: true },
      fakeAdapter()
    )
      .methods(vi.fn(), vi.fn())
      .html(null, null, false);
    expect(expandable.querySelector(".actions")).not.toBeNull();
  });
});
