import { describe, expect, it, vi } from "vitest";

import { dividerContent } from "./divider.ts";

describe("dividerContent", () => {
  it("creates a divider with correct attributes", () => {
    const parser = dividerContent({
      title: "A helpful hint",
      attrs: { "data-hello": "world!" },
    });
    const el = parser
      .methods({
        id: null,
        onChange: vi.fn(),
        getValue: vi.fn((): never => null as never),
      })
      .html("hr-id", null, false);

    expect(el.tagName).toBe("HR");
    expect(el.getAttribute("id")).toBe("hr-id");
    expect(el.getAttribute("title")).toBe("A helpful hint");
    expect(el.dataset.hello).toBe("world!");
  });

  it("should have defaults with an empty object", () => {
    const parser = dividerContent({});
    const el = parser
      .methods({
        id: null,
        onChange: vi.fn(),
        getValue: vi.fn((): never => null as never),
      })
      .html(null, null, false);

    expect(el.tagName).toBe("HR");
    expect(el.hasAttribute("id")).toBe(false);
  });
});
