import type { UnionToTuple } from "niall-utils";

import type {
  AnyParserRecord,
  AnySiblingContext,
  InitParserObject,
} from "./types.ts";

export namespace PathFlags {
  export type Parent = "..";
  export type Root = "~";
}

export const PATH_PARENT: PathFlags.Parent = "..";
export const PATH_ROOT: PathFlags.Root = "~";

export type Path = readonly PropertyKey[];

declare const dependencySymbol: unique symbol;

export interface Dependency<T, P extends Path = Path> {
  readonly [dependencySymbol]: T;
  readonly path: P;
}

export type AnyDependency = Dependency<unknown>;
export type AnyDependencies = readonly AnyDependency[];

export const dependency =
  <T>() =>
  <const P extends Path>(...path: P): Dependency<T, P> =>
    ({ path }) as Dependency<T, P>;

/** Maps a tuple of `Dependency<T, P>` to the tuple of their `T`s, e.g. for spreading resolved
 * values positionally into a multi-dependency compute function. */
export type DependencyValues<Deps extends AnyDependencies> = {
  [K in keyof Deps]: Deps[K] extends Dependency<infer T> ? T : never;
};

/** Cancels every adjacent `[key, ".."]` pair, left to right - a leftover leading `".."` means the
 * path reaches further up than this reduction alone can tell. `PrevItem` holds the one real key
 * (if any) seen just before the current position, not yet emitted because it might still be
 * cancelled by what comes next; it's cleared (defaults to `never`) whenever the held-back key
 * actually gets cancelled or committed. Without tracking this, a bare `First extends
 * PathFlags.Parent` check on its own can't tell "a leftover `".."` with nothing before it to
 * cancel" apart from "a real key that's about to be cancelled" - both look like `PropertyKey` at
 * that position - so two consecutive `".."` (e.g. two real levels up, written as `["..", "..",
 * "plan"]`) would wrongly cancel each other out instead of staying as two leftover hops. */
export type ResolvePath<P extends Path, PrevItem = never> = P extends readonly [
  infer First extends PropertyKey,
  ...infer Rest extends Path,
]
  ? First extends PathFlags.Parent
    ? [PrevItem] extends [never]
      ? readonly [First, ...ResolvePath<Rest>]
      : ResolvePath<Rest>
    : [PrevItem] extends [never]
      ? ResolvePath<Rest, First>
      : readonly [PrevItem, ...ResolvePath<Rest, First>]
  : [PrevItem] extends [never]
    ? readonly []
    : readonly [PrevItem];

/** Runtime mirror of {@link ResolvePath} - JS has no fixed-point recursive conditional types, so
 * this collapses each `[key, ".."]` pair with a single stack pass instead. */
export const resolvePath = (path: Path): Path => {
  const resolved: PropertyKey[] = [];
  for (const segment of path) {
    if (
      segment === PATH_PARENT &&
      resolved.length > 0 &&
      resolved.at(-1) !== PATH_PARENT
    ) {
      resolved.pop();
    } else {
      resolved.push(segment);
    }
  }
  return resolved;
};

export interface DependencyError<
  Declared extends Path = Path,
  Resolved extends Path = Path,
  Kind extends "missing-path" | "type-mismatch" =
    "missing-path" | "type-mismatch",
  Expected = unknown,
  Found = unknown,
> {
  readonly __error: `dependency ${Kind}`;
  readonly declaredPath: Declared;
  readonly resolvedPath: Resolved;
  readonly expected?: Expected;
  readonly found?: Found;
}

/** True when `A`'s length isn't a fixed literal - a table's row-array or a list's item-array,
 * whose real length is a runtime fact (rows/items can be added or removed), as opposed to one
 * table row's own fixed-width column tuple, whose arity is known up front. */
type IsDynamicArray<A extends readonly unknown[]> = number extends A["length"]
  ? true
  : false;

/** Whether a dependency declaring `T` is compatible with what a path actually resolves to
 * (`Found`) - accepting subtyping in EITHER direction, since a `Dependency` is built two
 * different ways with two different natural directions: `dependency<T>()(...)` lets a caller
 * declare a (possibly wider) type it'll treat the value as (`Found extends T`), while
 * `equals`/`satisfies` infer `T` as the narrow literal value being compared against a (possibly
 * wider) real type, e.g. a `selectParser`'s `"a" | "b"` (`T extends Found`). Tuple-wrapped so a
 * union `Found` is checked as one whole type, not distributed member-by-member. Whichever
 * direction matches, `Found`'s own possible `undefined` (from indexing a dynamic array - see
 * {@link CheckArrayDepExists}) must still show up in `T` too - matching one specific case can't
 * let a caller silently ignore that the value might not exist at all. */
type Compatible<Found, T> = (
  [Found] extends [T] ? true : [T] extends [Found] ? true : false
) extends true
  ? undefined extends Found
    ? undefined extends T
      ? true
      : false
    : true
  : false;

/** Walks an already-resolved (no `".."` left) path down through `O`, checking existence and
 * type at each step. `Declared`/`Resolved` stay fixed for error reporting; `Remaining` shrinks. */
type CheckDepExists<
  O extends AnyParserRecord,
  Declared extends Path,
  Resolved extends Path,
  Remaining extends Path,
  T,
> = Remaining extends readonly [
  infer I extends PropertyKey,
  ...infer Rest extends Path,
]
  ? I extends keyof O
    ? Rest extends readonly []
      ? Compatible<O[I], T> extends true
        ? { pending: null }
        : DependencyError<Declared, Resolved, "type-mismatch", T, O[I]>
      : NonNullable<O[I]> extends AnyParserRecord
        ? CheckDepExists<NonNullable<O[I]>, Declared, Resolved, Rest, T>
        : NonNullable<O[I]> extends readonly unknown[]
          ? CheckArrayDepExists<NonNullable<O[I]>, Declared, Resolved, Rest, T>
          : DependencyError<Declared, Resolved, "missing-path">
    : DependencyError<Declared, Resolved, "missing-path">
  : { pending: null };

/** Continues {@link CheckDepExists}'s walk once the path has stepped into an array-valued field
 * - a table's rows, a list's items, or one table row's own fixed-width columns. A dynamic array's
 * real length isn't known at compile time, so indexing it might come up empty at runtime even
 * when the index looks in-range; `Found` is unioned with `undefined` to force whoever declares
 * such a dependency to account for that. A fixed-width tuple needs no such widening: TS's own
 * indexed access already resolves an out-of-range literal index to `undefined` on its own, and an
 * in-range one to the exact element type. */
type CheckArrayDepExists<
  A extends readonly unknown[],
  Declared extends Path,
  Resolved extends Path,
  Remaining extends Path,
  T,
> = Remaining extends readonly [
  infer I extends PropertyKey,
  ...infer Rest extends Path,
]
  ? I extends keyof A
    ? (
        IsDynamicArray<A> extends true ? A[I] | undefined : A[I]
      ) extends infer Found
      ? Rest extends readonly []
        ? Compatible<Found, T> extends true
          ? { pending: null }
          : DependencyError<Declared, Resolved, "type-mismatch", T, Found>
        : NonNullable<Found> extends AnyParserRecord
          ? CheckDepExists<NonNullable<Found>, Declared, Resolved, Rest, T>
          : NonNullable<Found> extends readonly unknown[]
            ? CheckArrayDepExists<
                NonNullable<Found>,
                Declared,
                Resolved,
                Rest,
                T
              >
            : DependencyError<Declared, Resolved, "missing-path">
      : never
    : DependencyError<Declared, Resolved, "missing-path">
  : { pending: null };

/** Per-dependency step of the per-container algorithm: resolve what this container's own `O`
 * can answer immediately, defer the rest (one `".."` hop consumed) for the parent to try. */
type ResolveDependency<
  O extends AnyParserRecord,
  Dep extends AnyDependency,
  IsRoot extends boolean,
> =
  Dep extends Dependency<infer T, infer Declared extends Path>
    ? Declared extends readonly [PathFlags.Root, ...infer Rest extends Path]
      ? IsRoot extends true
        ? CheckDepExists<O, Declared, Rest, Rest, T>
        : { pending: Dep }
      : ResolvePath<Declared> extends infer Resolved extends Path
        ? Resolved extends readonly [
            PathFlags.Parent,
            ...infer Rest extends Path,
          ]
          ? IsRoot extends true
            ? DependencyError<Declared, Resolved, "missing-path">
            : { pending: Dependency<T, Rest> }
          : CheckDepExists<O, Declared, Resolved, Resolved, T>
        : never
    : never;

/** `Deps extends readonly [...] ? ... : ...` below is a bare-type-parameter (distributive)
 * conditional, which for `Deps = never` (a field with no deps at all - the common case)
 * collapses the WHOLE conditional straight to `never`, skipping both branches, rather than
 * hitting the empty-tuple fallback. Guarding `[Deps] extends [never]` first (the standard
 * tuple-wrap idiom for testing never-ness non-distributively) heads that off before the
 * distributive check ever sees a `never` input. */
type ValidateDeps<
  O extends AnyParserRecord,
  Deps extends AnyDependencies,
  IsRoot extends boolean,
> = [Deps] extends [never]
  ? { valid: true; pending: readonly [] }
  : Deps extends readonly [
        infer Head extends AnyDependency,
        ...infer Tail extends AnyDependencies,
      ]
    ? ResolveDependency<O, Head, IsRoot> extends infer HeadResult
      ? HeadResult extends DependencyError
        ? HeadResult
        : HeadResult extends { pending: infer P }
          ? ValidateDeps<O, Tail, IsRoot> extends infer TailResult
            ? TailResult extends DependencyError
              ? TailResult
              : TailResult extends {
                    valid: true;
                    pending: infer TP extends AnyDependencies;
                  }
                ? {
                    valid: true;
                    pending: P extends AnyDependency ? readonly [P, ...TP] : TP;
                  }
                : never
            : never
          : never
      : never
    : { valid: true; pending: readonly [] };

/** Flattens every field's own `deps` (declared relative to this container) into one tuple.
 * Guarded against the all-fields-have-no-deps case (`AllDeps` is `never`) before ever calling
 * `UnionToTuple` on it - `niall-utils`' `UnionToTuple<never>` doesn't return `never` or `readonly
 * []`, it returns `[never]` (a real one-element tuple wrapping a `never` element, an artifact of
 * its `Exclude`-based recursion), which would otherwise flow on and collapse a later distributive
 * check (`ResolveDependency`) straight to `never`. */
type FieldDeps<Fields> = {
  [K in keyof Fields]: Fields[K] extends {
    deps?: infer D extends AnyDependencies;
  }
    ? D[number]
    : never;
}[keyof Fields] extends infer AllDeps
  ? [AllDeps] extends [never]
    ? readonly []
    : UnionToTuple<AllDeps>
  : never;

/** The per-container validation gate shared by `groupParser` and `createParsers`. Resolves
 * whatever dependencies this container's own `O` can answer, and returns the still-pending
 * remainder (always empty when `IsRoot` is true, since there's nowhere left to defer to). */
export type ValidateScope<
  O extends AnyParserRecord,
  Fields extends InitParserObject<O>,
  IsRoot extends boolean,
> =
  FieldDeps<Fields> extends infer Deps extends AnyDependencies
    ? ValidateDeps<O, Deps, IsRoot>
    : never;

/** Runtime mirror of {@link ResolveDependency}'s path algebra (existence/type checks are
 * compile-time only - JS has no use for them at runtime). Used by `groupParser` to compute the
 * actual `deps` it exposes to whatever contains it. */
export const resolveDependency = (
  dep: { path: Path },
  isRoot: boolean
): { path: Path } | null => {
  if (dep.path[0] === PATH_ROOT) {
    return isRoot ? null : dep;
  }

  const resolved = resolvePath(dep.path);
  if (resolved[0] === PATH_PARENT) {
    return isRoot ? null : { path: resolved.slice(1) };
  }

  return null;
};

/** `"~"` needs no registry-level handling - it's dispatched to the absolute variant here, once,
 * before the path ever reaches a `FieldRegistry`. */
export const getPath = (siblings: AnySiblingContext, path: Path): unknown =>
  path[0] === PATH_ROOT
    ? siblings.getAbsolute(path.slice(1))
    : siblings.get(path);

export const subscribePath = (
  siblings: AnySiblingContext,
  path: Path,
  cb: (value: unknown) => void
): (() => void) =>
  path[0] === PATH_ROOT
    ? siblings.subscribeAbsolute(path.slice(1), cb)
    : siblings.subscribe(path, cb);
