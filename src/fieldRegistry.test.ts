import { describe, expect, it, vi } from "vitest";

import { FieldRegistry } from "./fieldRegistry.ts";

describe("FieldRegistry", () => {
  describe("get", () => {
    it("reads a registered field's value", () => {
      const registry = new FieldRegistry();
      registry.register("foo", () => "value");
      expect(registry.get(["foo"])).toBe("value");
    });

    it("drills into a registered field's value with any remaining path segments", () => {
      const registry = new FieldRegistry();
      registry.register("foo", () => ({ bar: { baz: "deep" } }));
      expect(registry.get(["foo", "bar", "baz"])).toBe("deep");
    });

    it("throws for an unregistered id", () => {
      const registry = new FieldRegistry();
      expect(() => registry.get(["missing"])).toThrow(
        /No sibling field registered for id "missing"/
      );
    });

    it("delegates to the parent when the path starts with '..'", () => {
      const parent = new FieldRegistry();
      parent.register("foo", () => "parent-value");
      const child = new FieldRegistry(parent.context());
      expect(child.get(["..", "foo"])).toBe("parent-value");
    });

    it("throws when '..' is used with no parent", () => {
      const registry = new FieldRegistry();
      expect(() => registry.get(["..", "foo"])).toThrow(
        /No enclosing scope to resolve "\.\." against/
      );
    });
  });

  describe("getAbsolute", () => {
    it("behaves like get at the root (no parent)", () => {
      const registry = new FieldRegistry();
      registry.register("foo", () => "value");
      expect(registry.getAbsolute(["foo"])).toBe("value");
    });

    it("delegates all the way up to the root when nested", () => {
      const root = new FieldRegistry();
      root.register("foo", () => "root-value");
      const middle = new FieldRegistry(root.context());
      const leaf = new FieldRegistry(middle.context());
      expect(leaf.getAbsolute(["foo"])).toBe("root-value");
    });
  });

  describe("subscribe", () => {
    it("notifies a subscriber, drilling into the notified value with the path's remaining segments", () => {
      const registry = new FieldRegistry();
      const cb = vi.fn();
      registry.subscribe(["foo", "bar"], cb);
      registry.notify("foo", { bar: "value" });
      expect(cb).toHaveBeenCalledWith("value");
    });

    it("stops notifying after unsubscribing", () => {
      const registry = new FieldRegistry();
      const cb = vi.fn();
      const unsubscribe = registry.subscribe(["foo"], cb);
      unsubscribe();
      registry.notify("foo", "value");
      expect(cb).not.toHaveBeenCalled();
    });

    it("delegates to the parent when the path starts with '..'", () => {
      const parent = new FieldRegistry();
      const child = new FieldRegistry(parent.context());
      const cb = vi.fn();
      child.subscribe(["..", "foo"], cb);
      parent.notify("foo", "parent-value");
      expect(cb).toHaveBeenCalledWith("parent-value");
    });

    it("throws when '..' is used with no parent", () => {
      const registry = new FieldRegistry();
      expect(() => registry.subscribe(["..", "foo"], vi.fn())).toThrow(
        /No enclosing scope to resolve "\.\." against/
      );
    });
  });

  describe("subscribeAbsolute", () => {
    it("behaves like subscribe at the root (no parent)", () => {
      const registry = new FieldRegistry();
      const cb = vi.fn();
      registry.subscribeAbsolute(["foo"], cb);
      registry.notify("foo", "value");
      expect(cb).toHaveBeenCalledWith("value");
    });

    it("delegates all the way up to the root when nested", () => {
      const root = new FieldRegistry();
      const middle = new FieldRegistry(root.context());
      const leaf = new FieldRegistry(middle.context());
      const cb = vi.fn();
      leaf.subscribeAbsolute(["foo"], cb);
      root.notify("foo", "root-value");
      expect(cb).toHaveBeenCalledWith("root-value");
    });
  });

  describe("context", () => {
    it("exposes get/getAbsolute/subscribe/subscribeAbsolute bound to the registry", () => {
      const registry = new FieldRegistry();
      registry.register("foo", () => "value");
      const context = registry.context();

      expect(context.get(["foo"])).toBe("value");
      expect(context.getAbsolute(["foo"])).toBe("value");

      const cb = vi.fn();
      context.subscribe(["foo"], cb);
      registry.notify("foo", "changed");
      expect(cb).toHaveBeenCalledWith("changed");
    });
  });
});
