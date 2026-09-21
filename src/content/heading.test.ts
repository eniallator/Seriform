import { describe, expect, it, vi } from "vitest";

import { headingContent } from "./heading.ts";

describe("headingContent", () => {
  it("creates a heading with correct text, level and attributes", () => {
    const parser = headingContent({
      text: "Section title",
      level: 3,
      title: "A helpful hint",
      attrs: { "data-hello": "world!" },
    });
    const el = parser
      .methods({
        id: null,
        onChange: vi.fn(),
        getValue: vi.fn((): never => null as never),
      })
      .html("h-id", null, false);

    expect(el.tagName).toBe("H3");
    expect(el.textContent).toBe("Section title");
    expect(el.getAttribute("id")).toBe("h-id");
    expect(el.getAttribute("title")).toBe("A helpful hint");
    expect(el.dataset.hello).toBe("world!");
  });

  it("defaults to a level 2 heading with an empty object", () => {
    const parser = headingContent({});
    const el = parser
      .methods({
        id: null,
        onChange: vi.fn(),
        getValue: vi.fn((): never => null as never),
      })
      .html(null, null, false);

    expect(el.tagName).toBe("H2");
    expect(el.textContent).toBe("");
    expect(el.hasAttribute("id")).toBe(false);
  });
});
