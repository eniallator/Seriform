import { describe, expect, it, vi } from "vitest";

import { hashKey } from "../../helpers.ts";
import { equals } from "../conditional/condition.ts";
import { ifParser } from "../conditional/if.ts";
import { when } from "../conditional/when.ts";
import { buttonParser } from "../content/button.ts";
import { checkboxParser, selectParser, textParser } from "../value/index.ts";
import { encodeArray, encodeRecord } from "./encoding.ts";
import { groupParser } from "./group.ts";

describe("groupParser", () => {
  const children = {
    name: textParser({ default: "" }),
    active: checkboxParser({ default: false }),
  };

  it("renders each child wrapped with its own label/title", () => {
    const parser = groupParser({
      children: {
        name: textParser({ label: "Name", default: "" }),
        active: checkboxParser({ label: "Active", default: false }),
      },
    }).methods({ id: null, onChange: vi.fn(), getValue: vi.fn() });
    const el = parser.html("group", null, false);

    const items = [...el.querySelectorAll(".config-item")];
    expect(items).toHaveLength(2);
    expect(items[0]?.querySelector("label")?.textContent).toBe("Name");
    expect(items[1]?.querySelector("label")?.textContent).toBe("Active");
  });

  it("getValue assembles the composite object from each child's DOM", () => {
    const parser = groupParser({ children }).methods({
      id: null,
      onChange: vi.fn(),
      getValue: vi.fn(),
    });
    const el = parser.html("group", null, false);

    (el.querySelector('input[type="text"]') as HTMLInputElement).value =
      "Alice";
    el.querySelector('input[type="checkbox"]')?.setAttribute("checked", "");

    expect(parser.getValue(el)).toStrictEqual({ name: "Alice", active: true });
  });

  it("onChange merges an updated child's value into the composite object", () => {
    const onChange = vi.fn();
    const parser = groupParser({ children }).methods({
      id: null,
      onChange,
      getValue: () => ({
        name: "Alice",
        active: false,
      }),
    });
    const el = parser.html("group", null, false);

    const input = el.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = "Bob";
    input.onchange?.({} as Event);

    expect(onChange).toHaveBeenCalledWith({ name: "Bob", active: false });
  });

  it("serialise/decode round-trips each child's own serialisation through a keyed record", () => {
    const value = { name: "Alice", active: true };
    const parser = groupParser({ children }).methods({
      id: null,
      onChange: vi.fn(),
      getValue: () => value,
    });
    parser.html("group", null, false);

    const serialised = parser.serialise(false);
    expect(serialised).toBe(encodeRecord({ name: "Alice", active: "true" }));

    const decodedParser = groupParser({ children }).methods({
      id: null,
      onChange: vi.fn(),
      getValue: vi.fn(),
    });
    const decodedEl = decodedParser.html("group", serialised ?? null, false);
    expect(decodedParser.getValue(decodedEl)).toStrictEqual(value);
  });

  it("serialise/decode round-trips child keys through hashKey when shortUrl is true", () => {
    const value = { name: "Alice", active: true };
    const parser = groupParser({ children }).methods({
      id: null,
      onChange: vi.fn(),
      getValue: () => value,
    });
    parser.html("group", null, false);

    const serialised = parser.serialise(true);
    expect(serialised).toBe(
      encodeArray([`${hashKey("name", 2)}Alice`, `${hashKey("active", 2)}1`])
    );

    const decodedParser = groupParser({ children }).methods({
      id: null,
      onChange: vi.fn(),
      getValue: vi.fn(),
    });
    const decodedEl = decodedParser.html("group", serialised ?? null, true);
    expect(decodedParser.getValue(decodedEl)).toStrictEqual(value);
  });

  it("decodes a wholly-empty short-record array (a zero-length hash key and an empty value)", () => {
    const emptyValueChildren = { name: textParser({ default: "hello" }) };
    const parser = groupParser({
      children: emptyValueChildren,
      hashLength: 0,
    }).methods({
      id: null,
      onChange: vi.fn(),
      getValue: () => ({ name: "" }),
    });
    parser.html("group", null, false);

    const serialised = parser.serialise(true);
    expect(serialised).toBe(".");

    const decodedParser = groupParser({
      children: emptyValueChildren,
      hashLength: 0,
    }).methods({ id: null, onChange: vi.fn(), getValue: vi.fn() });
    const decodedEl = decodedParser.html("group", serialised ?? null, true);
    expect(decodedParser.getValue(decodedEl)).toStrictEqual({ name: "" });
  });

  it("serialise returns null when every child is at its own default", () => {
    const parser = groupParser({ children }).methods({
      id: null,
      onChange: vi.fn(),
      getValue: () => ({
        name: "",
        active: false,
      }),
    });
    parser.html("group", null, false);

    expect(parser.serialise(false)).toBeNull();
  });

  it("serialise only includes children that changed from their own default", () => {
    const value = { name: "Alice", active: false };
    const parser = groupParser({ children }).methods({
      id: null,
      onChange: vi.fn(),
      getValue: () => value,
    });
    parser.html("group", null, false);

    const serialised = parser.serialise(false);
    expect(serialised).toBe(encodeRecord({ name: "Alice" }));

    const decodedParser = groupParser({ children }).methods({
      id: null,
      onChange: vi.fn(),
      getValue: vi.fn(),
    });
    const decodedEl = decodedParser.html("group", serialised ?? null, false);
    expect(decodedParser.getValue(decodedEl)).toStrictEqual(value);
  });

  it("updateValue re-renders each child from the current composite value", () => {
    let value = { name: "Alice", active: false };
    const parser = groupParser({ children }).methods({
      id: null,
      onChange: vi.fn(),
      getValue: () => value,
    });
    const el = parser.html("group", null, false);

    value = { name: "Bob", active: true };
    parser.updateValue(el, false);

    expect(
      (el.querySelector('input[type="text"]') as HTMLInputElement).value
    ).toBe("Bob");
    expect(
      (el.querySelector('input[type="checkbox"]') as HTMLInputElement).checked
    ).toBe(true);
  });

  it("excludes content-only children from serialise, DOM value, and record decoding", () => {
    const withButton = {
      name: textParser({ default: "" }),
      action: buttonParser({ text: "Go" }),
    };

    const domParser = groupParser({ children: withButton }).methods({
      id: null,
      onChange: vi.fn(),
      getValue: vi.fn(),
    });
    const el = domParser.html("group", null, false);
    (el.querySelector('input[type="text"]') as HTMLInputElement).value =
      "Alice";
    expect(domParser.getValue(el)).toStrictEqual({
      name: "Alice",
      action: null,
    });

    const serialiseParser = groupParser({ children: withButton }).methods({
      id: null,
      onChange: vi.fn(),
      getValue: () => ({
        name: "Alice",
        action: null as never,
      }),
    });
    serialiseParser.html("group", null, false);
    expect(serialiseParser.serialise(false)).toBe(
      encodeRecord({ name: "Alice" })
    );
  });

  it("propagates externalCfg's initial value per-key to each child", () => {
    const parser = groupParser({ children }).methods({
      id: null,
      onChange: vi.fn(),
      getValue: vi.fn(() => ({ name: "", active: false })),
      externalCfg: {
        initial: { name: "Alice", active: true },
        default: { name: "", active: false },
      },
    });
    const el = parser.html(null, null, false);

    expect(
      (el.querySelector('input[type="text"]') as HTMLInputElement).value
    ).toBe("Alice");
    expect(
      (
        el.querySelector('input[type="checkbox"]') as HTMLInputElement
      ).hasAttribute("checked")
    ).toBe(true);
  });

  it("falls back to externalCfg's default per-key when initial is null", () => {
    const parser = groupParser({ children }).methods({
      id: null,
      onChange: vi.fn(),
      getValue: vi.fn(() => ({ name: "", active: false })),
      externalCfg: {
        initial: null,
        default: { name: "Fallback", active: false },
      },
    });
    const el = parser.html(null, null, false);

    expect(
      (el.querySelector('input[type="text"]') as HTMLInputElement).value
    ).toBe("Fallback");
  });

  it("applies title and attrs to the wrapper element", () => {
    const parser = groupParser({
      children,
      title: "A hint",
      attrs: { "data-hello": "world!" },
    }).methods({ id: null, onChange: vi.fn(), getValue: vi.fn() });
    const el = parser.html("group", null, false);

    expect(el.getAttribute("title")).toBe("A hint");
    expect(el.dataset.hello).toBe("world!");
  });

  describe("nested conditional parsers (siblings wiring)", () => {
    it.fails(
      "a nested `when` becomes visible once its sibling condition is met",
      () => {
        let value: { plan: "free" | "pro"; detail: string | undefined } = {
          plan: "free",
          detail: undefined,
        };
        const parser = groupParser({
          children: {
            plan: selectParser({ default: "free", options: ["free", "pro"] }),
            detail: when({
              condition: equals("plan", "pro"),
              parser: textParser({ default: "" }),
            }),
          },
        }).methods({
          id: null,
          onChange: v => {
            value = v;
          },
          getValue: () => value,
        });
        const el = parser.html("group", null, false);

        const detailWrapper = el.querySelectorAll(".config-item")[1]
          ?.lastElementChild as HTMLElement;
        expect(detailWrapper.classList.contains("hidden")).toBe(true);

        const select = el.querySelector("select") as HTMLSelectElement;
        select.value = "pro";
        select.onchange?.({} as Event);

        expect(detailWrapper.classList.contains("hidden")).toBe(false);
        expect(value.detail).toBe("");
      }
    );

    it.fails(
      "a nested `ifParser` switches branches once its sibling condition is met",
      () => {
        const parser = groupParser({
          children: {
            plan: selectParser({ default: "free", options: ["free", "pro"] }),
            detail: ifParser({
              branches: [
                {
                  condition: equals("plan", "pro"),
                  parser: textParser({ default: "Pro details" }),
                },
              ],
              otherwise: textParser({ default: "fallback" }),
            }),
          },
        }).methods({
          id: null,
          onChange: vi.fn(),
          getValue: vi.fn((): { plan: "free" | "pro"; detail: string } => ({
            plan: "free",
            detail: "fallback",
          })),
        });
        const el = parser.html("group", null, false);

        const select = el.querySelector("select") as HTMLSelectElement;
        select.value = "pro";
        select.onchange?.({} as Event);

        const detailInput = el
          .querySelectorAll(".config-item")[1]
          ?.querySelector("input") as HTMLInputElement;
        expect(detailInput.value).toBe("Pro details");
      }
    );
  });
});
