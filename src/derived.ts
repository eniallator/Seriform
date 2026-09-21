import {
  dependency,
  type AnyDependencies,
  type Dependency,
  type DependencyValues,
  type Path,
} from "./dependency.ts";
import type { AnyParserValue } from "./types.ts";

/**
 * A value of type `T` computed from multiple dependencies together (unlike a plain `Dependency`,
 * which just names one path + its expected type). `derive`'s stored type is deliberately widened
 * to `(...values: any[]) => T` rather than the precise `(...values: DependencyValues<Deps>) => T`
 * - `derived` (below) is what actually type-checks the callback an author writes. A
 * generic-defaulted *function* field using `Deps` directly here makes TS elaborate every element
 * against the default (`AnyDependencies`) whenever a `Derived<...>` sits inside an array-typed
 * generic constraint (e.g. `ifParser`'s branches), silently rejecting perfectly valid narrower
 * instances - confirmed in isolation; `unknown[]` doesn't rescue this either (contravariance
 * still bites, one level in, inside `derived`'s own cast) - only `any[]` sidesteps variance
 * checking entirely.
 */
export interface Derived<T, Deps extends AnyDependencies = AnyDependencies> {
  deps: Deps;
  derive: (...values: any[]) => T;
}

export const derived = <T, const Deps extends AnyDependencies>(
  derive: (...values: DependencyValues<Deps>) => T,
  ...deps: Deps
): Derived<T, Deps> => ({ deps, derive });

/** A boolean `Derived` from a single dependency, tested against a predicate - the building block
 * behind `equals`, and directly useful for anything a strict-equals check can't express (a range
 * check, a substring match, ...). */
export const satisfies = <T extends AnyParserValue, const P extends Path>(
  path: P,
  test: (value: T) => boolean
): Derived<boolean, readonly [Dependency<T, P>]> =>
  derived(test, dependency<T>()(...path));

export const equals = <T extends AnyParserValue, const P extends Path>(
  path: P,
  value: T
): Derived<boolean, readonly [Dependency<T, P>]> =>
  satisfies(path, current => current === value);

/** Inverts a boolean `Derived` without touching its dependencies - what `unless` uses internally
 * to build on `when`'s own condition handling instead of duplicating it. */
export const negate = <Deps extends AnyDependencies>(
  condition: Derived<boolean, Deps>
): Derived<boolean, Deps> =>
  derived((...values) => !condition.derive(...values), ...condition.deps);
