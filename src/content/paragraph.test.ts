import { describe, expect, it, vi } from "vitest";

import { dependency } from "../dependency.ts";
import { derived } from "../derived.ts";
import { FieldRegistry } from "../fieldRegistry.ts";
import { paragraphContent } from "./paragraph.ts";

describe("paragraphContent", () => {
  it("creates a paragraph with correct text and attributes", () => {
    const parser = paragraphContent({
      text: "Hello world",
      title: "A helpful hint",
      attrs: { "data-hello": "world!" },
    });
    const el = parser
      .methods({
        id: null,
        onChange: vi.fn(),
        getValue: vi.fn((): never => null as never),
      })
      .html("p-id", null, false);

    expect(el.tagName).toBe("P");
    expect(el.textContent).toBe("Hello world");
    expect(el.getAttribute("id")).toBe("p-id");
    expect(el.getAttribute("title")).toBe("A helpful hint");
    expect(el.dataset.hello).toBe("world!");
  });

  it("should have defaults with an empty object", () => {
    const parser = paragraphContent({});
    const el = parser
      .methods({
        id: null,
        onChange: vi.fn(),
        getValue: vi.fn((): never => null as never),
      })
      .html(null, null, false);

    expect(el.tagName).toBe("P");
    expect(el.textContent).toBe("");
    expect(el.hasAttribute("id")).toBe(false);
  });

  it("renders derived text computed from a sibling value", () => {
    let name = "Ada";
    const registry = new FieldRegistry();
    registry.register("name", () => name);

    const parser = paragraphContent({
      text: derived(
        current => `Hello, ${current}!`,
        dependency<string>()("name")
      ),
    });
    const el = parser
      .methods({
        id: null,
        onChange: vi.fn(),
        getValue: vi.fn((): never => null as never),
        siblings: registry.context(),
      })
      .html(null, null, false);

    expect(el.textContent).toBe("Hello, Ada!");

    name = "Grace";
    registry.notify("name", name);

    expect(el.textContent).toBe("Hello, Grace!");
  });

  it("falls back to an empty string for derived text with no siblings context", () => {
    const parser = paragraphContent({
      text: derived(
        current => `Hello, ${current}!`,
        dependency<string>()("name")
      ),
    });
    const el = parser
      .methods({
        id: null,
        onChange: vi.fn(),
        getValue: vi.fn((): never => null as never),
      })
      .html(null, null, false);

    expect(el.textContent).toBe("");
  });
});
