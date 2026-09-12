import { describe, expect, it, vi } from "vitest";

import { buttonParser } from "./button.ts";

describe("buttonParser", () => {
  it("creates a button with correct text and attributes", () => {
    const parser = buttonParser({
      text: "Click me",
      title: "A helpful hint",
      attrs: { "data-hello": "world!" },
    });
    const el = parser
      .methods(
        vi.fn(),
        vi.fn((): never => null as never)
      )
      .html("btn-id", null, false);

    expect(el.tagName).toBe("BUTTON");
    expect(el.textContent).toBe("Click me");
    expect(el.getAttribute("id")).toBe("btn-id");
    expect(el.getAttribute("title")).toBe("A helpful hint");
    expect(el.dataset.hello).toBe("world!");
  });

  it("calls onChange when clicked", () => {
    const parser = buttonParser({});
    const onChange = vi.fn();
    const el = parser
      .methods(
        onChange,
        vi.fn((): never => null as never)
      )
      .html("id", null, false);

    el.click();

    expect(onChange).toHaveBeenCalled();
  });

  it("should have defaults with an empty object", () => {
    const parser = buttonParser({});
    const el = parser
      .methods(
        vi.fn(),
        vi.fn((): never => null as never)
      )
      .html(null, null, false);

    expect(el.tagName).toBe("BUTTON");
    expect(el.textContent).toBe("");
    expect(el.hasAttribute("id")).toBe(false);
  });
});
