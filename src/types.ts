import type { Path } from "./dependency.ts";

export type AnyParserValue = NonNullable<unknown> | undefined;
export type AnyParserRecord = Record<string, AnyParserValue>;

export interface AnySiblingContext {
  get: (path: Path) => unknown;
  getAbsolute: (path: Path) => unknown;
  subscribe: (path: Path, cb: (value: unknown) => void) => () => void;
  subscribeAbsolute: (path: Path, cb: (value: unknown) => void) => () => void;
}
