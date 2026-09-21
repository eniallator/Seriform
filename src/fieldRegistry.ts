import { raise } from "niall-utils/core";

import { PATH_PARENT, type Path } from "./dependencies.ts";
import type { AnySiblingContext } from "./types.ts";

const drill = (value: unknown, path: Path): unknown =>
  path.reduce<unknown>(
    (current, key) =>
      (current as Record<PropertyKey, unknown> | undefined)?.[key],
    value
  );

export class FieldRegistry {
  private readonly parent?: AnySiblingContext;
  private readonly getters = new Map<string, () => unknown>();
  private readonly subscribers = new Map<
    string,
    Set<(value: unknown) => void>
  >();

  constructor(parent?: AnySiblingContext) {
    this.parent = parent;
  }

  register(id: string, getValue: () => unknown): void {
    this.getters.set(id, getValue);
  }

  notify(id: string, value: unknown): void {
    this.subscribers.get(id)?.forEach(cb => {
      cb(value);
    });
  }

  get(path: Path): unknown {
    if (path[0] === PATH_PARENT) {
      return (
        this.parent?.get(path.slice(1)) ??
        raise(new Error('No enclosing scope to resolve ".." against.'))
      );
    }

    const [id, ...rest] = path;
    return drill(
      this.getters.get(id as string)?.() ??
        raise(new Error(`No sibling field registered for id "${String(id)}".`)),
      rest
    );
  }

  getAbsolute(path: Path): unknown {
    return this.parent != null ? this.parent.getAbsolute(path) : this.get(path);
  }

  subscribe(path: Path, cb: (value: unknown) => void): () => void {
    if (path[0] === PATH_PARENT) {
      return (
        this.parent?.subscribe(path.slice(1), cb) ??
        raise(new Error('No enclosing scope to resolve ".." against.'))
      );
    }

    const [id, ...rest] = path;
    const set = this.subscribers.get(id as string) ?? new Set();
    this.subscribers.set(id as string, set);

    const wrapped = (value: unknown): void => {
      cb(drill(value, rest));
    };
    set.add(wrapped);
    return () => {
      set.delete(wrapped);
    };
  }

  subscribeAbsolute(path: Path, cb: (value: unknown) => void): () => void {
    return this.parent != null
      ? this.parent.subscribeAbsolute(path, cb)
      : this.subscribe(path, cb);
  }

  context(): AnySiblingContext {
    return {
      get: path => this.get(path),
      getAbsolute: path => this.getAbsolute(path),
      subscribe: (path, cb) => this.subscribe(path, cb),
      subscribeAbsolute: (path, cb) => this.subscribeAbsolute(path, cb),
    };
  }
}
