import { describe, expect, it, vi } from "vitest";

import { imageContent } from "./image.ts";

describe("imageContent", () => {
  it("creates an image with correct attributes", () => {
    const parser = imageContent({
      title: "A helpful hint",
      attrs: { src: "logo.png", alt: "Logo" },
    });
    const el = parser
      .methods({
        id: null,
        onChange: vi.fn(),
        getValue: vi.fn((): never => null as never),
      })
      .html("img-id", null, false);

    expect(el.tagName).toBe("IMG");
    expect(el.getAttribute("id")).toBe("img-id");
    expect(el.getAttribute("title")).toBe("A helpful hint");
    expect(el.getAttribute("src")).toBe("logo.png");
    expect(el.getAttribute("alt")).toBe("Logo");
  });

  it("should have defaults with an empty object", () => {
    const parser = imageContent({});
    const el = parser
      .methods({
        id: null,
        onChange: vi.fn(),
        getValue: vi.fn((): never => null as never),
      })
      .html(null, null, false);

    expect(el.tagName).toBe("IMG");
    expect(el.hasAttribute("id")).toBe(false);
  });
});
