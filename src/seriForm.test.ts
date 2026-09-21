import { beforeEach, describe, expect, it, vi } from "vitest";

import { equals } from "./derived.ts";
import { hashKey } from "./helpers.ts";
import { contentParser, createParsers, valueParser } from "./parser.ts";
import { when } from "./parsers/conditional/when.ts";
import { selectParser, textParser } from "./parsers/value/index.ts";
import { SeriForm } from "./seriForm.ts";
import type { AnySiblingContext, InitParserObject } from "./types.ts";

interface CapturedFooFns {
  onChange?: (value: string) => void;
  getValue?: () => string;
  siblings?: AnySiblingContext;
}

const makeParsers = (captured: CapturedFooFns) =>
  createParsers({
    foo: valueParser<string>(
      ({ onChange, getValue, siblings }) => {
        captured.onChange = onChange;
        captured.getValue = getValue;
        captured.siblings = siblings;
        return {
          serialise: vi.fn(() => "serialised"),
          getValue: vi.fn(() => "parsed"),
          updateValue: vi.fn(),
          html: vi.fn(() => document.createElement("input")),
        };
      },
      "Foo",
      "Foo Title"
    ),
    bar: contentParser(
      () => document.createElement("button"),
      "Bar",
      "Bar Title"
    ),
  });

type TestParserValues =
  ReturnType<typeof makeParsers> extends InitParserObject<infer T> ? T : never;

describe("SeriForm", () => {
  let baseEl: HTMLElement;
  let seriform: SeriForm<TestParserValues>;
  let captured: CapturedFooFns;

  beforeEach(() => {
    baseEl = document.createElement("div");
    captured = {};
    seriform = new SeriForm(makeParsers(captured), baseEl, {
      query: location.search,
    });
  });

  // --- getAllValues ---
  it("getAllValues returns all values", () => {
    expect(seriform.getAllValues()).toEqual({
      foo: "parsed",
      bar: null,
    });
  });

  // --- getValue ---
  it("getValue returns the value for a key", () => {
    expect(seriform.getValue("foo")).toBe("parsed");
    expect(seriform.getValue("bar")).toBeNull();
  });

  // --- setValue ---
  it("setValue updates the value and calls updateValue if updateValue is defined", () => {
    seriform.setValue("foo", "newVal");
    expect(seriform.getValue("foo")).toBe("newVal");

    seriform.setValue("bar", "test" as never);
    expect(seriform.getValue("bar")).toBeNull();
  });

  // --- addListener & tellListeners ---
  it("addListener and tellListeners notify listeners", () => {
    const cb = vi.fn();
    seriform.addListener(cb);
    seriform.tellListeners("foo");
    expect(cb).toHaveBeenCalledWith(seriform.getAllValues(), "foo");
  });

  it("addListener with empty subscriptions notifies on any update", () => {
    const cb = vi.fn();

    seriform.addListener(cb, []);
    seriform.tellListeners("foo");
    expect(cb).toHaveBeenCalled();

    cb.mockClear();
    seriform.tellListeners("bar");
    expect(cb).toHaveBeenCalled();
  });

  it("tellListeners only notifies listeners subscribed to the id", () => {
    const cb = vi.fn();
    seriform.addListener(cb, ["foo"]);
    seriform.tellListeners("bar");
    expect(cb).not.toHaveBeenCalled();

    seriform.tellListeners("foo");
    expect(cb).toHaveBeenCalled();
  });

  // --- parser onChange / getValue ---
  it("parser onChange updates the value and notifies listeners when non-null", () => {
    const cb = vi.fn();
    seriform.addListener(cb);

    captured.onChange?.("changed");

    expect(seriform.getValue("foo")).toBe("changed");
    expect(cb).toHaveBeenCalledWith(seriform.getAllValues(), "foo");
  });

  it("parser onChange leaves the value unchanged when null", () => {
    captured.onChange?.(null as unknown as string);

    expect(seriform.getValue("foo")).toBe("parsed");
  });

  it("parser getValue reads the current state", () => {
    captured.onChange?.("changed");

    expect(captured.getValue?.()).toBe("changed");
  });

  // --- sibling context ---
  it("siblings.get reads a sibling's live value", () => {
    captured.onChange?.("changed");
    expect(captured.siblings?.get(["foo"])).toBe("changed");
  });

  it("siblings.get throws for an unregistered id", () => {
    expect(() => captured.siblings?.get(["missing"])).toThrow(
      /No sibling field registered/
    );
  });

  it("siblings.subscribe is notified on change, and stops after unsubscribing", () => {
    const cb = vi.fn();
    const unsubscribe = captured.siblings?.subscribe(["foo"], cb);

    captured.onChange?.("changed");
    expect(cb).toHaveBeenCalledWith("changed");

    cb.mockClear();
    unsubscribe?.();
    captured.onChange?.("changed again");
    expect(cb).not.toHaveBeenCalled();
  });

  // --- construction-time sibling reads ---
  it("a field can synchronously read an earlier-declared sibling's value while building its own DOM", () => {
    // Mirrors `ifParser`, which evaluates its condition (a synchronous `siblings.getValue`
    // call) while building its own DOM, during `SeriForm`'s construction - i.e. before every
    // field's state entry has necessarily been populated yet.
    let siblingValueDuringConstruction: unknown;

    const config = createParsers({
      first: valueParser<string>(
        () => ({
          serialise: vi.fn(() => null),
          getValue: vi.fn(() => "first-value"),
          updateValue: vi.fn(),
          html: vi.fn(() => document.createElement("input")),
        }),
        "First"
      ),
      second: valueParser<string>(
        ({ siblings }) => ({
          serialise: vi.fn(() => null),
          getValue: vi.fn(() => "second-value"),
          updateValue: vi.fn(),
          html: vi.fn(() => {
            siblingValueDuringConstruction = siblings?.get(["first"]);
            return document.createElement("input");
          }),
        }),
        "Second"
      ),
    });

    expect(
      () => new SeriForm(config, document.createElement("div"), { query: "" })
    ).not.toThrow();
    expect(siblingValueDuringConstruction).toBe("first-value");
  });

  // --- addCopyToClipboardHandler ---
  it("addCopyToClipboardHandler copies the share URL when clicked", () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const button = document.createElement("button");
    button.id = "share-btn";
    baseEl.appendChild(button);
    document.body.appendChild(baseEl);

    seriform.addCopyToClipboardHandler("#share-btn");
    button.click();

    expect(writeText).toHaveBeenCalledWith(
      `${location.protocol}//${location.host}${location.pathname}?foo=serialised`
    );

    document.body.removeChild(baseEl);
  });

  it("addCopyToClipboardHandler omits the query string when there is none", () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const contentOnlySeriform = new SeriForm(
      createParsers({
        bar: contentParser(
          () => document.createElement("button"),
          "Bar",
          "Bar Title"
        ),
      }),
      baseEl,
      { query: "" }
    );

    const button = document.createElement("button");
    button.id = "share-btn-2";
    baseEl.appendChild(button);
    document.body.appendChild(baseEl);

    contentOnlySeriform.addCopyToClipboardHandler("#share-btn-2");
    button.click();

    expect(writeText).toHaveBeenCalledWith(
      `${location.protocol}//${location.host}${location.pathname}`
    );

    document.body.removeChild(baseEl);
  });

  // --- serialiseToUrlParams ---
  it("serialiseToUrlParams returns correct string", () => {
    const result = seriform.serialiseToUrlParams();
    expect(result).toBe("foo=serialised");
  });

  it("serialiseToUrlParams uses hashed keys with no '=' separator for shortUrl mode, defaulting the hash length to 6", () => {
    const defaultHashLength = new SeriForm(makeParsers({}), baseEl, {
      query: "",
      shortUrl: true,
    });
    expect(defaultHashLength.serialiseToUrlParams()).toBe(
      `${hashKey("foo", 6)}serialised`
    );

    const explicitHashLength = new SeriForm(makeParsers({}), baseEl, {
      query: "",
      shortUrl: true,
      hashLength: 4,
    });
    expect(explicitHashLength.serialiseToUrlParams()).toBe(
      `${hashKey("foo", 4)}serialised`
    );
  });

  it("serialiseToUrlParams handles no extra", () => {
    expect(seriform.serialiseToUrlParams()).toBe("foo=serialised");
  });
});

describe("SeriForm + conditional parsers", () => {
  it("getValue reports undefined for a `when` field once its condition stops being met", () => {
    const config = createParsers({
      plan: selectParser({ default: "free", options: ["free", "pro"] }),
      detail: when({
        condition: equals(["plan"], "pro"),
        parser: textParser({ default: "" }),
      }),
    });
    const baseEl = document.createElement("div");
    const form = new SeriForm(config, baseEl, { query: "" });

    expect(form.getValue("detail")).toBeUndefined();

    const select = baseEl.querySelector("select") as HTMLSelectElement;
    select.value = "pro";
    select.onchange?.({} as Event);
    expect(form.getValue("detail")).toBe("");

    select.value = "free";
    select.onchange?.({} as Event);
    expect(form.getValue("detail")).toBeUndefined();
  });
});
