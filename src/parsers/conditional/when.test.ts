import { describe, expect, it, vi } from "vitest";

import { equals, satisfies } from "../../derived.ts";
import { FieldRegistry } from "../../fieldRegistry.ts";
import { createParsers } from "../../parser.ts";
import type { AnySiblingContext } from "../../types.ts";
import { groupParser } from "../nested/group.ts";
import { listParser } from "../nested/list.ts";
import { tableParser } from "../nested/table.ts";
import { checkboxParser, numberParser, textParser } from "../value/index.ts";
import { unless, when } from "./when.ts";

const makeSiblings = () => {
  const subscribers = new Map<string, (value: unknown) => void>();
  let currentPlan: unknown;
  const context: AnySiblingContext = {
    get: vi.fn((path: readonly PropertyKey[]) =>
      JSON.stringify(path) === JSON.stringify(["plan"])
        ? currentPlan
        : undefined
    ),
    getAbsolute: vi.fn(),
    subscribe: vi.fn(
      (path: readonly PropertyKey[], cb: (value: unknown) => void) => {
        subscribers.set(JSON.stringify(path), cb);
        return () => subscribers.delete(JSON.stringify(path));
      }
    ),
    subscribeAbsolute: vi.fn(),
  };
  return {
    context,
    trigger: (value: string) => {
      currentPlan = value;
      subscribers.get(JSON.stringify(["plan"]))?.(value);
    },
  };
};

describe("when", () => {
  const buildParser = () =>
    when({
      condition: equals(["plan"], "pro"),
      parser: textParser({ default: "" }),
    });

  it("stays hidden and never subscribes when no siblings context is available at all", () => {
    const parser = buildParser().methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: vi.fn(),
    });
    const el = parser.html("conditional", null, false);

    expect(el.classList.contains("hidden")).toBe(true);
    expect(parser.getValue(el)).toBeUndefined();
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
      condition: equals(["plan"], "pro"),
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
      condition: equals(["plan"], "pro"),
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
      condition: equals(["plan"], "pro"),
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

describe("dependency paths into a listParser (dynamic array)", () => {
  const buildParser = () =>
    when({
      condition: satisfies(
        ["numbers", 1] as const,
        (value: number | undefined) => value === 2
      ),
      parser: textParser({ default: "" }),
    });

  it("reacts to an in-range list item", () => {
    let numbers = [1, 2, 3];
    const registry = new FieldRegistry();
    registry.register("numbers", () => numbers);

    const parser = buildParser().methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: vi.fn(),
      siblings: registry.context(),
    });
    const el = parser.html("conditional", null, false);

    expect(el.classList.contains("hidden")).toBe(true);

    registry.notify("numbers", numbers);
    expect(el.classList.contains("hidden")).toBe(false);

    numbers = [1, 5, 3];
    registry.notify("numbers", numbers);
    expect(el.classList.contains("hidden")).toBe(true);
  });

  it("resolves an out-of-bounds index to undefined rather than throwing", () => {
    let numbers = [1, 2, 3];
    const registry = new FieldRegistry();
    registry.register("numbers", () => numbers);

    const outOfBounds = when({
      condition: satisfies(
        ["numbers", 10] as const,
        (value: number | undefined) => value === undefined
      ),
      parser: textParser({ default: "" }),
    }).methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: vi.fn(),
      siblings: registry.context(),
    });
    const el = outOfBounds.html("conditional", null, false);

    registry.notify("numbers", numbers);
    expect(el.classList.contains("hidden")).toBe(false);

    numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    registry.notify("numbers", numbers);
    expect(el.classList.contains("hidden")).toBe(true);
  });
});

describe("dependency paths into a tableParser (rows + fixed columns)", () => {
  const buildRoster = (): (readonly [string, boolean])[] => [
    ["Alice", true],
    ["Bob", false],
  ];

  it("reacts to a specific row's column value", () => {
    let roster = buildRoster();
    const registry = new FieldRegistry();
    registry.register("roster", () => roster);

    const parser = when({
      condition: equals(["roster", 0, 1] as const, true),
      parser: textParser({ default: "" }),
    }).methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: vi.fn(),
      siblings: registry.context(),
    });
    const el = parser.html("conditional", null, false);

    registry.notify("roster", roster);
    expect(el.classList.contains("hidden")).toBe(false);

    roster = [
      ["Alice", false],
      ["Bob", false],
    ];
    registry.notify("roster", roster);
    expect(el.classList.contains("hidden")).toBe(true);
  });

  it("reacts to a whole row, unioned with undefined since rows can be added/removed", () => {
    let roster = buildRoster();
    const registry = new FieldRegistry();
    registry.register("roster", () => roster);

    const parser = when({
      condition: satisfies(
        ["roster", 1] as const,
        (row: readonly [string, boolean] | undefined) => row?.[0] === "Bob"
      ),
      parser: textParser({ default: "" }),
    }).methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: vi.fn(),
      siblings: registry.context(),
    });
    const el = parser.html("conditional", null, false);

    registry.notify("roster", roster);
    expect(el.classList.contains("hidden")).toBe(false);

    roster = [["Alice", true]];
    registry.notify("roster", roster);
    expect(el.classList.contains("hidden")).toBe(true);
  });

  it("resolves an out-of-bounds row index to undefined rather than throwing", () => {
    let roster = buildRoster();
    const registry = new FieldRegistry();
    registry.register("roster", () => roster);

    const parser = when({
      condition: satisfies(
        ["roster", 5] as const,
        (row: readonly [string, boolean] | undefined) => row === undefined
      ),
      parser: textParser({ default: "" }),
    }).methods({
      id: "conditional",
      onChange: vi.fn(),
      getValue: vi.fn(),
      siblings: registry.context(),
    });
    const el = parser.html("conditional", null, false);

    registry.notify("roster", roster);
    expect(el.classList.contains("hidden")).toBe(false);

    roster = [...buildRoster(), ...buildRoster(), ...buildRoster()];
    registry.notify("roster", roster);
    expect(el.classList.contains("hidden")).toBe(true);
  });
});

describe("dependency paths as a real config (type-level integration)", () => {
  it("type-checks equals/satisfies against real tableParser/listParser/groupParser fields", () => {
    const config = createParsers({
      numbers: listParser({
        field: numberParser({ default: 0 }),
        default: [1, 2, 3],
      }),
      roster: tableParser({
        fields: [
          textParser({ default: "" }),
          checkboxParser({ default: false }),
        ],
        default: [["Alice", true]],
      }),
      nested: groupParser({
        children: {
          items: listParser({
            field: numberParser({ default: 0 }),
            default: [],
          }),
        },
      }),
      detail: when({
        condition: satisfies(
          ["nested", "items", 0] as const,
          (value: number | undefined) => value === 1
        ),
        parser: textParser({ default: "" }),
      }),
      column: when({
        condition: equals(["roster", 0, 1] as const, true),
        parser: textParser({ default: "" }),
      }),
      row: when({
        condition: satisfies(
          ["roster", 0] as const,
          (row: readonly [string, boolean] | undefined) => row != null
        ),
        parser: textParser({ default: "" }),
      }),
    });

    expect(config).toBeDefined();
  });
});
