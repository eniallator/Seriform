import type { Base64 } from "niall-utils/encoding";
import { dom } from "niall-utils/ui";

import {
  getPath,
  subscribePath,
  type AnyDependencies,
  type ValidateScope,
} from "./dependency.ts";
import type { Derived } from "./derived.ts";
import type {
  AnyParserRecord,
  AnyParserValue,
  AnySiblingContext,
} from "./types.ts";

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

export interface BaseConfig {
  label?: string;
  title?: string;
  attrs?: Record<string, string | number | null>;
}

export interface ValueConfig<T> extends BaseConfig {
  default?: T;
}

export interface ContentConfig<
  Deps extends AnyDependencies = AnyDependencies,
> extends BaseConfig {
  text?: string | Derived<string, Deps>;
}

export const createParsers = <
  const Fields extends InitParserObject<FieldsValue<Fields>>,
>(
  parsers: ScopedFields<FieldsValue<Fields>, Fields, true, Fields>
): ResolvedParserObject<FieldsValue<Fields>> =>
  parsers as ResolvedParserObject<FieldsValue<Fields>>;

export const valueParser = <
  T extends AnyParserValue,
  const Deps extends AnyDependencies | undefined = undefined,
>(
  methods: (ctx: MethodsContext<T>) => Required<Parser<T>>,
  label?: string,
  title?: string,
  deps?: Deps
): InitParser<Required<Parser<T>>, Deps> => ({ label, title, methods, deps });

/**
 * Resolves a `ContentConfig["text"]` to its current plain-string value - `derive`d against live
 * sibling values when it's a `Derived`, or returned as-is when it's a plain string. Falls back to
 * an empty string when there's no text, or a `Derived` text is resolved with no `siblings`
 * context available (mirrors `when`'s own siblings-optional handling).
 */
const resolveContentText = <Deps extends AnyDependencies>(
  text: string | Derived<string, Deps> | undefined,
  siblings: AnySiblingContext | undefined
): string => {
  if (text == null) return "";
  if (typeof text === "string") return text;
  return siblings == null
    ? ""
    : text.derive(...text.deps.map(dep => getPath(siblings, dep.path)));
};

/**
 * Re-resolves a `Derived` `text` and calls `onUpdate` with the new plain-string value whenever
 * any of its dependencies change - a no-op for a plain string (nothing to subscribe to) or when
 * there's no `siblings` context.
 */
const subscribeContentText = <Deps extends AnyDependencies>(
  text: string | Derived<string, Deps> | undefined,
  siblings: AnySiblingContext | undefined,
  onUpdate: (text: string) => void
): void => {
  if (siblings == null || text == null || typeof text === "string") return;
  text.deps.forEach(dep => {
    subscribePath(siblings, dep.path, () => {
      onUpdate(resolveContentText(text, siblings));
    });
  });
};

/**
 * The shared builder behind every content element (`buttonContent`, `paragraphContent`, ...): a
 * field that holds no value of its own (`getValue` is always `null`). Handles the boilerplate
 * every content element would otherwise repeat - building the `id`/`title`/`attrs` attribute
 * string, and resolving/subscribing `cfg.text` - so `initHtml` only needs to place the already-
 * resolved `text` and `attrs` into its own markup. `text` is kept in sync on the returned
 * element's `textContent` whenever a `Derived` text's dependencies change, since every content
 * element's entire visible output is just its top-level element's text.
 */
export const contentParser = <const Deps extends AnyDependencies = readonly []>(
  cfg: ContentConfig<Deps>,
  initHtml: (onChange: () => void, text: string, attrs: string) => HTMLElement
): InitParser<Parser, Deps> => ({
  label: cfg.label,
  title: cfg.title,
  deps: (typeof cfg.text === "object" ? cfg.text.deps : []) as unknown as Deps,
  methods: ({ onChange, siblings }) => ({
    getValue: () => null as never,
    html: id => {
      const attrs = dom.toAttrs({
        ...(id != null && { id }),
        ...(cfg.title != null && { title: cfg.title }),
        ...cfg.attrs,
      });

      const el = initHtml(
        () => {
          onChange(null as never);
        },
        resolveContentText(cfg.text, siblings),
        attrs
      );
      subscribeContentText(cfg.text, siblings, text => {
        el.textContent = text;
      });
      return el;
    },
  }),
});
