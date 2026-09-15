import type { Base64 } from "niall-utils/encoding";

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
  getValue: (id: string) => unknown;
  subscribe: (id: string, cb: (value: unknown) => void) => () => void;
}

export interface SiblingContext<Cfg extends AnyParserRecord> {
  getValue: <K extends keyof Cfg>(id: K) => Cfg[K];
  subscribe: <K extends keyof Cfg>(
    id: K,
    cb: (value: Cfg[K]) => void
  ) => () => void;
}

export interface MethodsContext<
  T extends AnyParserValue,
  S = AnySiblingContext,
> {
  id: string | null;
  onChange: (value: T) => void;
  getValue: () => T;
  externalCfg?: { initial: T | null; default: T };
  siblings?: S;
}

export declare const requiredConfig: unique symbol;

export interface InitParser<
  P extends Parser<AnyParserValue>,
  Cfg extends AnyParserRecord = AnyParserRecord,
> {
  label?: string;
  title?: string;
  methods: (ctx: MethodsContext<ParserValue<P>>) => P;
  /**
   * Phantom marker (never actually assigned) recording the shape of sibling fields this
   * parser's `siblings` context expects. `InitParserObject` pins this to `Partial<O>` (the
   * whole schema, weakened so a field only needing a subset of it still matches), so a field
   * declaring a narrower, incompatible, or non-existent sibling shape fails to structurally
   * satisfy it - surfacing a compile error at that exact field. `Partial` also makes it a TS
   * "weak type", so a `requiredConfig` with zero overlapping keys is rejected outright rather than
   * silently accepted as an unrelated excess property.
   */
  readonly [requiredConfig]?: Cfg;
}

export type InitParserObject<
  O extends AnyParserRecord = AnyParserRecord,
  Cfg extends AnyParserRecord = Partial<O>,
> = { [K in keyof O]: InitParser<Parser<O[K]>, NoInfer<Cfg>> };

/**
 * The type `createParsers` returns: shaped exactly like `InitParserObject<O, Partial<O>>`, but
 * given its own mapped-type body (rather than just aliasing `InitParserObject<O>`) so it keeps its
 * own name - with a single generic parameter and no `Cfg` - when consumers extract `O` back out
 * (`typeof config extends ResolvedParserObject<infer O> ? O : never`) or hover over `config`.
 */
export type ResolvedParserObject<O extends AnyParserRecord = AnyParserRecord> =
  { [K in keyof O]: InitParser<Parser<O[K]>, NoInfer<Partial<O>>> };
