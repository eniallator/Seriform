import { describe, expect, it, vi } from "vitest";

import type { AnySiblingContext } from "../../types.ts";
import { numberParser, textParser } from "../value/index.ts";
import { equals } from "./condition.ts";
import { ifParser } from "./if.ts";

const makeSiblings = () => {
  const values = new Map<string, unknown>();
  const subscribers = new Map<string, Set<(value: unknown) => void>>();
  const context: AnySiblingContext = {
    getValue: vi.fn((id: string) => values.get(id)),
    subscribe: vi.fn((id: string, cb: (value: unknown) => void) => {
      const cbs = subscribers.get(id) ?? new Set();
      cbs.add(cb);
      subscribers.set(id, cbs);
      return () => cbs.delete(cb);
    }),
  };
  return {
    context,
    trigger: (id: string, value: unknown) => {
      values.set(id, value);
      subscribers.get(id)?.forEach(cb => {
        cb(value);
      });
    },
  };
};

describe("ifParser", () => {
  const buildParser = () =>
    ifParser({
      branches: [
        {
          condition: equals("plan", "pro"),
          parser: textParser({ default: "" }),
        },
        {
          condition: equals("plan", "team"),
          parser: textParser({ default: "", area: true }),
        },
      ],
      otherwise: textParser({ default: "fallback" }),
    });

  it("defaults to otherwise immediately, before any sibling broadcast resolves", () => {
    const siblings = makeSiblings();
    const parser = buildParser().methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: vi.fn(),
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);

    expect(el.children).toHaveLength(1);
    expect(el.querySelector("input")).not.toBeNull();
    expect(parser.getValue(el)).toBe("fallback");
  });

  it("defaults to otherwise when no siblings context is available at all", () => {
    const parser = buildParser().methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: vi.fn(),
    });
    const el = parser.html("conditional", null, false);

    expect(el.children).toHaveLength(1);
    expect(el.querySelector("input")).not.toBeNull();
    expect(parser.getValue(el)).toBe("fallback");
  });

  it("mounts the first matching branch and reports its value", () => {
    const siblings = makeSiblings();
    const onChange = vi.fn();
    const parser = buildParser().methods({
      id: "conditional",
      onChange,
      getValue: vi.fn(),
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);

    siblings.trigger("plan", "pro");

    expect(el.querySelector('input[type="text"]')).not.toBeNull();
    expect(parser.getValue(el)).toBe("");
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("switches branches, tearing down the old element and mounting the new one", () => {
    const siblings = makeSiblings();
    const parser = buildParser().methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: vi.fn(),
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);

    siblings.trigger("plan", "pro");
    expect(el.querySelector('input[type="text"]')).not.toBeNull();

    siblings.trigger("plan", "team");
    expect(el.querySelector('input[type="text"]')).toBeNull();
    expect(el.querySelector("textarea")).not.toBeNull();
    expect(el.children).toHaveLength(1);
  });

  it("does nothing when notified with a value that keeps the same branch active", () => {
    const siblings = makeSiblings();
    const onChange = vi.fn();
    const parser = buildParser().methods({
      id: "conditional",
      onChange,
      getValue: vi.fn(),
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);

    siblings.trigger("plan", "pro");
    const input = el.querySelector("input");
    onChange.mockClear();

    siblings.trigger("plan", "pro");

    expect(onChange).not.toHaveBeenCalled();
    expect(el.querySelector("input")).toBe(input);
  });

  it("falls back to otherwise when no branch matches", () => {
    const siblings = makeSiblings();
    const parser = buildParser().methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: vi.fn(),
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);

    siblings.trigger("plan", "free");

    expect(el.querySelector("input")).not.toBeNull();
    expect(parser.getValue(el)).toBe("fallback");
  });

  it("switches from an active branch back to otherwise when it stops matching", () => {
    const siblings = makeSiblings();
    const onChange = vi.fn();
    const parser = buildParser().methods({
      id: "conditional",
      onChange,
      getValue: vi.fn(),
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);

    siblings.trigger("plan", "pro");
    onChange.mockClear();
    siblings.trigger("plan", "free");

    expect(parser.getValue(el)).toBe("fallback");
    expect(onChange).toHaveBeenCalledWith("fallback");
  });

  it("supports branches that test different sibling ids with different value types", () => {
    const siblings = makeSiblings();
    const parser = ifParser({
      branches: [
        {
          condition: equals("plan", "pro"),
          parser: textParser({ default: "" }),
        },
        {
          condition: equals("seats", 5),
          parser: numberParser({ default: 0 }),
        },
      ],
      otherwise: textParser({ default: "fallback" }),
    }).methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: vi.fn(),
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);

    siblings.trigger("seats", 5);

    expect(el.querySelector('input[type="number"]')).not.toBeNull();
    expect(parser.getValue(el)).toBe(0);

    siblings.trigger("plan", "pro");

    expect(el.querySelector('input[type="text"]')).not.toBeNull();
    expect(parser.getValue(el)).toBe("");
  });

  it("forwards the active child's onChange", () => {
    const siblings = makeSiblings();
    const onChange = vi.fn();
    const parser = buildParser().methods({
      id: "conditional",
      onChange,
      getValue: () => "",
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);
    siblings.trigger("plan", "pro");
    onChange.mockClear();

    const input = el.querySelector("input") as HTMLInputElement;
    input.value = "Alice";
    input.onchange?.({} as Event);

    expect(onChange).toHaveBeenCalledWith("Alice");
  });

  it("updateValue delegates to whichever child is currently active", () => {
    const siblings = makeSiblings();
    let currentValue = "";
    const parser = buildParser().methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: () => currentValue,
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);

    expect(() => {
      parser.updateValue(el, false);
    }).not.toThrow();

    siblings.trigger("plan", "pro");
    currentValue = "Alice";
    parser.updateValue(el, false);

    expect((el.querySelector("input") as HTMLInputElement).value).toBe("Alice");
  });

  it("serialise delegates to whichever child is currently active", () => {
    const siblings = makeSiblings();
    let currentValue = "fallback";
    const parser = buildParser().methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: () => currentValue,
      siblings: siblings.context,
    });
    parser.html("conditional", null, false);

    // otherwise is active by default, and "fallback" matches its own default.
    expect(parser.serialise(false)).toBeNull();

    siblings.trigger("plan", "pro");
    currentValue = "";
    // the "pro" branch is now active, and "" matches its own default.
    expect(parser.serialise(false)).toBeNull();

    currentValue = "Alice";
    expect(parser.serialise(false)).toBe("Alice");
  });

  it("passes the wrapper id through to the active child, and forwards attrs/title", () => {
    const siblings = makeSiblings();
    const parser = ifParser({
      branches: [
        {
          condition: equals("plan", "pro"),
          parser: textParser({ default: "" }),
        },
      ],
      otherwise: textParser({ default: "fallback" }),
      title: "A hint",
      attrs: { "data-hello": "world!" },
    }).methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: vi.fn(),
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);
    siblings.trigger("plan", "pro");

    expect(el.id).toBe("conditional");
    expect(el.getAttribute("title")).toBe("A hint");
    expect(el.dataset.hello).toBe("world!");
    expect(el.querySelector("input")?.id).toBe("conditional");
  });

  it("forwards externalCfg's initial value to whichever branch becomes active", () => {
    const siblings = makeSiblings();
    const parser = buildParser().methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: vi.fn(),
      externalCfg: { initial: "Alice", default: "" },
      siblings: siblings.context,
    });
    const el = parser.html("conditional", null, false);
    siblings.trigger("plan", "pro");

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
    siblings.trigger("plan", "pro");

    expect((el.querySelector("input") as HTMLInputElement).value).toBe(
      "Fallback"
    );
  });
});
