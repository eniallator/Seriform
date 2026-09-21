import type { Base64 } from "niall-utils/encoding";

import type { AnyDependencies, Path, ValidateScope } from "./dependencies.ts";

export type AnyParserValue = NonNullable<unknown> | undefined;
export type AnyParserRecord = Record<string, AnyParserValue>;

export interface Parser<T extends AnyParserValue = never> {
  html: (
    id: string | null,
    query: string | null,
    shortUrl: boolean
  ) => HTMLElement;
  getValue: (el: HTMLElement) => T;
  serialise?: (shortUrl: boolean) => string | Base64 | null;
  updateValue?: (el: HTMLElement, shortUrl: boolean) => void;
}

export type ParserValue<P extends Parser<AnyParserValue>> =
  P extends Parser<infer T> ? T : never;

export interface AnySiblingContext {
  get: (path: Path) => unknown;
  getAbsolute: (path: Path) => unknown;
  subscribe: (path: Path, cb: (value: unknown) => void) => () => void;
  subscribeAbsolute: (path: Path, cb: (value: unknown) => void) => () => void;
}

export interface MethodsContext<T extends AnyParserValue> {
  id: string | null;
  onChange: (value: T) => void;
  getValue: () => T;
  externalCfg?: { initial: T | null; default: T };
  siblings?: AnySiblingContext;
}

export interface InitParser<
  P extends Parser<AnyParserValue>,
  Deps extends AnyDependencies | undefined = AnyDependencies | undefined,
> {
  label?: string;
  title?: string;
  methods: (ctx: MethodsContext<ParserValue<P>>) => P;
  /**
   * The paths (relative to this field's own immediate container) this field - or, for a
   * container field like `groupParser`, its whole subtree - still needs from outside itself.
   * Read by the enclosing `groupParser`/`createParsers` call's `ValidateScope` to validate
   * whatever it can resolve against its own known shape, deferring the rest upward.
   *
   * Generic over `Deps` (rather than fixed to the general `AnyDependencies`) so that a
   * producer's own literal path/type info survives - a fixed `deps?: AnyDependencies` field
   * would erase exactly the literal tuple types `ValidateScope` needs to pattern-match against.
   */
  deps?: Deps;
}

export type InitParserObject<O extends AnyParserRecord = AnyParserRecord> = {
  [K in keyof O]: InitParser<Parser<O[K]>>;
};

export type ResolvedParserObject<O extends AnyParserRecord = AnyParserRecord> =
  InitParserObject<O>;

/**
 * The value shape a set of fields produces, read back off each field's own `InitParser` rather
 * than inferred as a separate generic - `keyof FieldsValue<Fields>` is then definitionally
 * `keyof Fields` (both range over the same mapped type), so no cast is ever needed to use one
 * where the other is expected, unlike an independently-inferred `O` extending `InitParserObject`.
 */
export type FieldsValue<Fields extends InitParserObject> = {
  [K in keyof Fields]: Fields[K] extends InitParser<Parser<infer V>>
    ? V
    : never;
};

/**
 * The "infer freely, then constrain the parameter's expected type after the fact" trick, shared
 * by `groupParser`'s and `createParsers`' own parameter types: `ValidateScope<O, Fields, IsRoot>`
 * is evaluated exactly once here (bound to `Result` via `infer`, not re-written a second time)
 * and reused by both branches, so an invalid dependency's `DependencyError` becomes the
 * parameter's required type and surfaces as a normal argument-type error at the call site.
 */
export type ScopedFields<
  O extends AnyParserRecord,
  Fields extends InitParserObject<O>,
  IsRoot extends boolean,
  Valid,
> =
  ValidateScope<O, Fields, IsRoot> extends infer Result
    ? Result extends { valid: true }
      ? Valid
      : Result
    : never;
