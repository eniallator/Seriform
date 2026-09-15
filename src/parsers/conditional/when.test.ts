import { describe, expect, it, vi } from "vitest";

import type { AnySiblingContext } from "../../types.ts";
import { textParser } from "../value/index.ts";
import { equals } from "./condition.ts";
import { unless, when } from "./when.ts";

const makeSiblings = () => {
  const subscribers = new Map<string, (value: unknown) => void>();
  const context: AnySiblingContext = {
    getValue: vi.fn(),
    subscribe: vi.fn((id: string, cb: (value: unknown) => void) => {
      subscribers.set(id, cb);
      return () => subscribers.delete(id);
    }),
  };
  return {
    context,
    trigger: (value: string) => subscribers.get("plan")?.(value),
  };
};

describe("when", () => {
  const buildParser = () =>
    when({
      condition: equals("plan", "pro"),
      parser: textParser({ default: "" }),
    });

  it("reports itself as hidden and reports no value until the condition holds", () => {
    const siblings = makeSiblings();
    const onChange = vi.fn();
    const parser = buildParser().methods({
      id: "conditional",
      onChange,
      getValue: vi.fn(),
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);

    expect(el.classList.contains("hidden")).toBe(true);
    expect(parser.getValue(el)).toBeUndefined();
    expect(parser.serialise(false)).toBeNull();
  });

  it("shows the child and reports its value once the condition holds", () => {
    const siblings = makeSiblings();
    const onChange = vi.fn();
    const parser = buildParser().methods({
      id: "conditional",
      onChange,
      getValue: vi.fn(),
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);

    siblings.trigger("pro");

    expect(el.classList.contains("hidden")).toBe(false);
    expect(parser.getValue(el)).toBe("");
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("serialise delegates to the child while visible, and returns null while hidden", () => {
    const siblings = makeSiblings();
    let currentValue = "";
    const parser = buildParser().methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: () => currentValue,
      siblings: siblings.context,
    });
    parser.html("conditional", null, false);

    expect(parser.serialise(false)).toBeNull();

    siblings.trigger("pro");
    expect(parser.serialise(false)).toBeNull();

    currentValue = "Alice";
    expect(parser.serialise(false)).toBe("Alice");
  });

  it("hides the child and reports no value once the condition stops holding", () => {
    const siblings = makeSiblings();
    const onChange = vi.fn();
    const parser = buildParser().methods({
      id: "conditional",
      onChange,
      getValue: vi.fn(),
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);

    siblings.trigger("pro");
    onChange.mockClear();
    siblings.trigger("free");

    expect(el.classList.contains("hidden")).toBe(true);
    expect(parser.getValue(el)).toBeUndefined();
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("does nothing when notified with a value that doesn't change visibility", () => {
    const siblings = makeSiblings();
    const onChange = vi.fn();
    const parser = buildParser().methods({
      id: "conditional",
      onChange,
      getValue: vi.fn(),
      siblings: siblings.context,
    });
    parser.html("conditional", null, false);

    siblings.trigger("free");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("forwards the child's onChange while visible, but suppresses it while hidden", () => {
    const siblings = makeSiblings();
    const onChange = vi.fn();
    const parser = buildParser().methods({
      id: "conditional",
      onChange,
      getValue: () => "",
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);
    const input = el.querySelector("input") as HTMLInputElement;

    input.value = "Alice";
    input.onchange?.({} as Event);
    expect(onChange).not.toHaveBeenCalled();

    siblings.trigger("pro");
    onChange.mockClear();

    input.value = "Bob";
    input.onchange?.({} as Event);
    expect(onChange).toHaveBeenCalledWith("Bob");
  });

  it("updateValue delegates to the underlying child regardless of visibility", () => {
    const siblings = makeSiblings();
    let currentValue = "Alice";
    const parser = buildParser().methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: () => currentValue,
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);

    currentValue = "Bob";
    parser.updateValue(el, false);

    expect((el.querySelector("input") as HTMLInputElement).value).toBe("Bob");
  });

  it("forwards externalCfg's initial value to the child", () => {
    const siblings = makeSiblings();
    const parser = buildParser().methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: vi.fn(),
      externalCfg: { initial: "Alice", default: "" },
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);
    siblings.trigger("pro");

    expect((el.querySelector("input") as HTMLInputElement).value).toBe("Alice");
  });

  it("falls back to externalCfg's default when initial is null", () => {
    const siblings = makeSiblings();
    const parser = buildParser().methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: vi.fn(),
      externalCfg: { initial: null, default: "Fallback" },
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);
    siblings.trigger("pro");

    expect((el.querySelector("input") as HTMLInputElement).value).toBe(
      "Fallback"
    );
  });

  it("survives being hidden and reshown without losing in-progress input", () => {
    const siblings = makeSiblings();
    const parser = buildParser().methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: () => "",
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);
    siblings.trigger("pro");

    const input = el.querySelector("input") as HTMLInputElement;
    input.value = "Alice";
    input.onchange?.({} as Event);

    siblings.trigger("free");
    siblings.trigger("pro");

    expect((el.querySelector("input") as HTMLInputElement).value).toBe("Alice");
  });

  it("renders with the given id and passes attrs/title through to the wrapper", () => {
    const siblings = makeSiblings();
    const parser = when({
      condition: equals("plan", "pro"),
      parser: textParser({ default: "" }),
      title: "A hint",
      attrs: { "data-hello": "world!" },
    }).methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: vi.fn(),
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);

    expect(el.id).toBe("conditional");
    expect(el.getAttribute("title")).toBe("A hint");
    expect(el.dataset.hello).toBe("world!");
  });
});

describe("unless", () => {
  it("shows the child when the condition does NOT hold", () => {
    const siblings = makeSiblings();
    const parser = unless({
      condition: equals("plan", "pro"),
      parser: textParser({ default: "" }),
    }).methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: vi.fn(),
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);

    siblings.trigger("free");

    expect(el.classList.contains("hidden")).toBe(false);
  });

  it("hides the child when the condition holds", () => {
    const siblings = makeSiblings();
    const parser = unless({
      condition: equals("plan", "pro"),
      parser: textParser({ default: "" }),
    }).methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: vi.fn(),
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);

    siblings.trigger("pro");

    expect(el.classList.contains("hidden")).toBe(true);
  });
});
