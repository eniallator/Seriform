import { raise } from "niall-utils/core";

import type { AnySiblingContext } from "./types.ts";

export class FieldRegistry {
  private readonly getters = new Map<string, () => unknown>();
  private readonly subscribers = new Map<
    string,
    Set<(value: unknown) => void>
  >();

  register(id: string, getValue: () => unknown): void {
    this.getters.set(id, getValue);
  }

  notify(id: string, value: unknown): void {
    this.subscribers.get(id)?.forEach(cb => {
      cb(value);
    });
  }

  subscribe(id: string, cb: (value: unknown) => void): () => void {
    const set = this.subscribers.get(id) ?? new Set();
    this.subscribers.set(id, set);
    set.add(cb);
    return () => {
      set.delete(cb);
    };
  }

  context(): AnySiblingContext {
    return {
      getValue: id =>
        this.getters.get(id)?.() ??
        raise(new Error(`No sibling field registered for id "${id}".`)),
      subscribe: (id, cb) => this.subscribe(id, cb),
    };
  }
}
