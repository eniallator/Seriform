import { describe, expect, it, vi } from "vitest";

import { buttonParser } from "../content/button.ts";
import { checkboxParser, textParser } from "../value/index.ts";
import { encodeFrames } from "./frames.ts";
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
    }).methods(vi.fn(), vi.fn());
    const el = parser.html("group", null, false);

    const items = [...el.querySelectorAll(".config-item")];
    expect(items).toHaveLength(2);
    expect(items[0]?.querySelector("label")?.textContent).toBe("Name");
    expect(items[1]?.querySelector("label")?.textContent).toBe("Active");
  });

  it("getValue assembles the composite object from each child's DOM", () => {
    const parser = groupParser({ children }).methods(vi.fn(), vi.fn());
    const el = parser.html("group", null, false);

    (el.querySelector('input[type="text"]') as HTMLInputElement).value =
      "Alice";
    el.querySelector('input[type="checkbox"]')?.setAttribute("checked", "");

    expect(parser.getValue(el)).toStrictEqual({ name: "Alice", active: true });
  });

  it("onChange merges an updated child's value into the composite object", () => {
    const onChange = vi.fn();
    const parser = groupParser({ children }).methods(onChange, () => ({
      name: "Alice",
      active: false,
    }));
    const el = parser.html("group", null, false);

    const input = el.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = "Bob";
    input.onchange?.({} as Event);

    expect(onChange).toHaveBeenCalledWith({ name: "Bob", active: false });
  });

  it("serialise/decode round-trips each child's own serialisation through frames", () => {
    const value = { name: "Alice", active: true };
    const parser = groupParser({ children }).methods(vi.fn(), () => value);
    parser.html("group", null, false);

    const serialised = parser.serialise(false);
    expect(serialised).toBe(encodeFrames(["Alice", "true"]));

    const decodedParser = groupParser({ children }).methods(vi.fn(), vi.fn());
    const decodedEl = decodedParser.html("group", serialised ?? null, false);
    expect(decodedParser.getValue(decodedEl)).toStrictEqual(value);
  });

  it("updateValue re-renders each child from the current composite value", () => {
    let value = { name: "Alice", active: false };
    const parser = groupParser({ children }).methods(vi.fn(), () => value);
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

  it("excludes content-only children from serialise, DOM value, and frame decoding", () => {
    const withButton = {
      name: textParser({ default: "" }),
      action: buttonParser({ text: "Go" }),
    };

    const domParser = groupParser({ children: withButton }).methods(
      vi.fn(),
      vi.fn()
    );
    const el = domParser.html("group", null, false);
    (el.querySelector('input[type="text"]') as HTMLInputElement).value =
      "Alice";
    expect(domParser.getValue(el)).toStrictEqual({
      name: "Alice",
      action: null,
    });

    const serialiseParser = groupParser({ children: withButton }).methods(
      vi.fn(),
      () => ({
        name: "Alice",
        action: null as never,
      })
    );
    serialiseParser.html("group", null, false);
    expect(serialiseParser.serialise(false)).toBe(encodeFrames(["Alice"]));
  });

  it("propagates externalCfg's initial value per-key to each child", () => {
    const parser = groupParser({ children }).methods(
      vi.fn(),
      vi.fn(() => ({ name: "", active: false })),
      {
        initial: { name: "Alice", active: true },
        default: { name: "", active: false },
      }
    );
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
    const parser = groupParser({ children }).methods(
      vi.fn(),
      vi.fn(() => ({ name: "", active: false })),
      { initial: null, default: { name: "Fallback", active: false } }
    );
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
    }).methods(vi.fn(), vi.fn());
    const el = parser.html("group", null, false);

    expect(el.getAttribute("title")).toBe("A hint");
    expect(el.dataset.hello).toBe("world!");
  });
});
