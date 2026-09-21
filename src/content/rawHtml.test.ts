import { describe, expect, it, vi } from "vitest";

import { rawHtmlContent } from "./rawHtml.ts";

describe("rawHtmlContent", () => {
  it("creates a wrapper with the given markup and attributes", () => {
    const parser = rawHtmlContent({
      html: "<strong>Bold</strong> text",
      title: "A helpful hint",
      attrs: { "data-hello": "world!" },
    });
    const el = parser
      .methods({
        id: null,
        onChange: vi.fn(),
        getValue: vi.fn((): never => null as never),
      })
      .html("raw-id", null, false);

    expect(el.tagName).toBe("DIV");
    expect(el.getAttribute("id")).toBe("raw-id");
    expect(el.getAttribute("title")).toBe("A helpful hint");
    expect(el.dataset.hello).toBe("world!");
    expect(el.innerHTML).toBe("<strong>Bold</strong> text");
  });

  it("should have defaults with just html", () => {
    const parser = rawHtmlContent({ html: "" });
    const el = parser
      .methods({
        id: null,
        onChange: vi.fn(),
        getValue: vi.fn((): never => null as never),
      })
      .html(null, null, false);

    expect(el.tagName).toBe("DIV");
    expect(el.hasAttribute("id")).toBe(false);
  });
});
