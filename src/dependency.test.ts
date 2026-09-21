import { describe, expect, it, vi } from "vitest";

import {
  getPath,
  resolveDependency,
  resolvePath,
  subscribePath,
} from "./dependency.ts";
import type { AnySiblingContext } from "./types.ts";

describe("resolvePath", () => {
  it("leaves a path with no '..' unchanged", () => {
    expect(resolvePath(["foo", "bar"])).toEqual(["foo", "bar"]);
  });

  it("cancels a [key, '..'] pair", () => {
    expect(resolvePath(["foo", ".."])).toEqual([]);
  });

  it("cancels only the adjacent pair, keeping the rest of the path", () => {
    expect(resolvePath(["foo", "bar", "..", "baz"])).toEqual(["foo", "baz"]);
  });

  it("keeps a leading '..' with nothing before it to cancel against", () => {
    expect(resolvePath(["..", "foo"])).toEqual(["..", "foo"]);
  });

  it("cancels repeated pairs left to right", () => {
    expect(resolvePath(["foo", "..", "bar", ".."])).toEqual([]);
  });
});

describe("resolveDependency", () => {
  it("defers a '~' path unchanged when not root", () => {
    const dep = { path: ["~", "foo"] };
    expect(resolveDependency(dep, false)).toBe(dep);
  });

  it("resolves a '~' path locally (returns null) when root", () => {
    expect(resolveDependency({ path: ["~", "foo"] }, true)).toBeNull();
  });

  it("propagates a dangling leading '..' upward with one hop stripped", () => {
    expect(resolveDependency({ path: ["..", "foo"] }, false)).toEqual({
      path: ["foo"],
    });
  });

  it("resolves a fully-resolvable path locally (returns null) regardless of root", () => {
    expect(resolveDependency({ path: ["foo", "bar"] }, false)).toBeNull();
    expect(resolveDependency({ path: ["foo"] }, true)).toBeNull();
  });

  it("resolves a dangling '..' locally (returns null) at the root", () => {
    expect(resolveDependency({ path: ["..", "foo"] }, true)).toBeNull();
  });
});

const makeSiblings = (): AnySiblingContext => ({
  get: vi.fn(),
  getAbsolute: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
  subscribeAbsolute: vi.fn(() => vi.fn()),
});

describe("getPath", () => {
  it("dispatches to getAbsolute, stripping the leading '~', for an absolute path", () => {
    const siblings = makeSiblings();
    getPath(siblings, ["~", "foo"]);
    expect(siblings.getAbsolute).toHaveBeenCalledWith(["foo"]);
    expect(siblings.get).not.toHaveBeenCalled();
  });

  it("dispatches to get for a relative path", () => {
    const siblings = makeSiblings();
    getPath(siblings, ["foo"]);
    expect(siblings.get).toHaveBeenCalledWith(["foo"]);
    expect(siblings.getAbsolute).not.toHaveBeenCalled();
  });
});

describe("subscribePath", () => {
  it("dispatches to subscribeAbsolute, stripping the leading '~', for an absolute path", () => {
    const siblings = makeSiblings();
    const cb = vi.fn();
    subscribePath(siblings, ["~", "foo"], cb);
    expect(siblings.subscribeAbsolute).toHaveBeenCalledWith(["foo"], cb);
    expect(siblings.subscribe).not.toHaveBeenCalled();
  });

  it("dispatches to subscribe for a relative path", () => {
    const siblings = makeSiblings();
    const cb = vi.fn();
    subscribePath(siblings, ["foo"], cb);
    expect(siblings.subscribe).toHaveBeenCalledWith(["foo"], cb);
    expect(siblings.subscribeAbsolute).not.toHaveBeenCalled();
  });
});
