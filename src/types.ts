import type { Base64 } from "niall-utils/encoding";

/** The bound for a single field's value: anything but `null` - `undefined` included, for a field
 * (e.g. `when`/`unless`) that may currently contribute no value at all. */
export type AnyParserValue = NonNullable<unknown> | undefined;

/** The bound for a schema/config record mapping field ids to their `AnyParserValue`s. */
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

/**
 * Gives a conditional parser (`when`/`unless`/`ifParser`) read/subscribe access to a sibling
 * field's live value by id, scoped to whichever `createParsers`/`groupParser` call built both
 * fields. Widened runtime form of `SiblingContext<Cfg>`, which parser implementations declare
 * against for their own ergonomics; `InitParser.methods` only ever sees this form.
 */
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

export interface InitParser<
  P extends Parser<AnyParserValue>,
  Cfg extends AnyParserRecord = AnyParserRecord,
> {
  label?: string;
  title?: string;
  methods: (
    onChange: (value: ParserValue<P>) => void,
    getValue: () => ParserValue<P>,
    externalCfg?: { initial: ParserValue<P> | null; default: ParserValue<P> },
    siblings?: AnySiblingContext
  ) => P;
  /**
   * Phantom marker (never actually assigned) recording the shape of sibling fields this
   * parser's `siblings` context expects. `InitParserObject` pins this to `Partial<O>` (the
   * whole schema, weakened so a field only needing a subset of it still matches), so a field
   * declaring a narrower, incompatible, or non-existent sibling shape fails to structurally
   * satisfy it - surfacing a compile error at that exact field. `Partial` also makes it a TS
   * "weak type", so a `__cfg` with zero overlapping keys is rejected outright rather than
   * silently accepted as an unrelated excess property.
   */
  readonly __cfg?: Cfg;
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
