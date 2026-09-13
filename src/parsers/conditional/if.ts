import { dom } from "niall-utils/ui";

import { valueParser } from "../../create.ts";
import type {
  AnyParserRecord,
  AnyParserValue,
  InitParser,
  Parser,
} from "../../types.ts";
import type { Config } from "../config.ts";
import type { Condition } from "./condition.ts";

export interface IfBranch<
  Cfg extends AnyParserRecord = AnyParserRecord,
  V extends AnyParserValue = AnyParserValue,
> {
  condition: Condition<Cfg>;
  parser: InitParser<Parser<V>>;
}

// `Cfg` is widened to `Record<string, any>` here (rather than `AnyParserRecord`) purely to avoid a
// spurious contravariance error TS raises when contextually typing a branches array literal
// against this constraint before `Branches` itself is inferred - `any` disables that strict
// function-parameter check for `Condition["test"]`, while `Branches`'s eventual inferred type
// still captures each branch's real, literal `Cfg`.
export type AnyBranches = readonly [
  IfBranch<Record<string, any>>,
  ...IfBranch<Record<string, any>>[],
];

export interface IfConfig<
  Branches extends AnyBranches,
  Otherwise extends AnyParserValue,
> extends Config {
  branches: Branches;
  otherwise: InitParser<Parser<Otherwise>>;
}

// Each defined with its own naked type parameter so invoking it with a union (e.g.
// `Branches[number]`) distributes: TS checks every union member separately and re-unions the
// results, rather than checking one combined type as a single non-distributed conditional.
// `IfBranch`'s other slot is pinned to `any` in both, not `AnyParserRecord`/`AnyParserValue` -
// pinning it to the real bound reintroduces the same contravariance rejection on
// `Condition["test"]`/`InitParser["methods"]` that `AnyBranches` widens away, since a branch's
// literal `Condition<Record<"plan","pro">>` isn't assignable to `Condition<AnyParserRecord>`.
type ConditionCfg<C> = C extends Condition<infer Cfg> ? Cfg : never;
type BranchValue<B> = B extends IfBranch<any, infer V> ? V : never;

// Turns the union of every branch's single-key condition `Cfg` into one combined record, unioning
// the value type at any key tested by more than one branch - e.g. two branches both testing
// "plan" (against "pro" and "team" respectively) merge into `{ plan: "pro" | "team" }` rather than
// colliding to `never` the way a plain intersection of the two records would.
type MergeRecords<U extends AnyParserRecord> = {
  [K in U extends unknown ? keyof U : never]: U extends Record<K, infer V>
    ? V
    : never;
};
type BranchesCfg<Branches extends AnyBranches> = MergeRecords<
  ConditionCfg<Branches[number]["condition"]>
>;

/**
 * Renders exactly one of `branches` - the first whose `condition` holds against its own sibling's
 * live value (branches may test different sibling ids and different value/parser types) - or
 * `otherwise` otherwise: unlike `when`/`unless` (which can legitimately contribute no value at
 * all), `otherwise` guarantees this field always resolves to a real `V`, so - unless a branch's
 * own parser independently contributes `undefined` to `V` (e.g. a nested `when`/`unless`) -
 * `undefined` is never part of the type. Evaluated eagerly against `siblings`' current values as
 * soon as `html` runs (falling back straight to `otherwise` if no `siblings` context is available
 * at all), rather than waiting for the first change broadcast. Unlike `when`/`unless` (which
 * toggle a single always-mounted child via `hidden`), only the active branch is ever mounted -
 * switching branches tears down the previous one and builds the new one fresh, the same way
 * `list`/`table` rebuild their rows.
 */
export const ifParser = <
  Branches extends AnyBranches,
  Otherwise extends AnyParserValue,
>(
  cfg: IfConfig<Branches, Otherwise>
): InitParser<
  Required<Parser<BranchValue<Branches[number]> | Otherwise>>,
  BranchesCfg<Branches>
> => {
  type Id = keyof BranchesCfg<Branches>;
  type V = BranchValue<Branches[number]> | Otherwise;

  // Erased to `AnyParserValue` here since, within this generic function body, TS can only assume
  // the declared `IfBranch` default shape for an abstract `Branches` - the precise per-branch `V`
  // only exists once `ifParser` is actually called. `getValue`/`onChange` below cast back to the
  // real, call-site-computed `V` at the boundary, the same way `groupParser`/`when` do.
  const branches = cfg.branches
    .map<{
      id: Id | null;
      test: ((value: AnyParserValue) => boolean) | null;
      parser: InitParser<Parser<AnyParserValue>>;
    }>(branch => ({
      id: branch.condition.id as Id,
      test: branch.condition.test,
      parser: branch.parser,
    }))
    .concat([{ id: null, test: null, parser: cfg.otherwise }]);
  const ids = new Set(cfg.branches.map(branch => branch.condition.id as Id));

  return valueParser<V, BranchesCfg<Branches>>(
    (onChange, getValue, externalCfg, siblings) => {
      let activeIndex = -1;
      let active: { parser: Parser<AnyParserValue>; el: HTMLElement } | null =
        null;

      return {
        getValue: () => active?.parser.getValue(active.el) as V,
        updateValue: (_wrapperEl, shortUrl) => {
          active?.parser.updateValue?.(active.el, shortUrl);
        },
        serialise: shortUrl => active?.parser.serialise?.(shortUrl) ?? null,
        html: (id, query, shortUrl) => {
          const attrs = dom.toAttrs({
            ...(id != null && { id }),
            ...(cfg.title != null && { title: cfg.title }),
            ...cfg.attrs,
          });
          const wrapperEl = dom.toHtml(`<div ${attrs}></div>`);

          const evaluate = () => {
            const index =
              siblings == null
                ? branches.length - 1
                : branches.findIndex(
                    ({ id, test }) =>
                      test == null ||
                      (id != null && test(siblings.getValue(id)))
                  );
            if (index === activeIndex) return;
            activeIndex = index;

            wrapperEl.innerHTML = "";

            // `branches` always contains the `otherwise` entry, whose `test` is `null` and so
            // always matches - `findIndex` therefore never returns -1 once it runs at all.
            const branch = branches[index] as (typeof branches)[number];

            const parser = branch.parser.methods(
              value => {
                onChange(value as V);
              },
              // Only read once this branch is active, at which point the field has already
              // reported a defined value for this id via `onChange` below.
              getValue,
              externalCfg?.default != null
                ? {
                    initial: externalCfg.initial ?? null,
                    default: externalCfg.default,
                  }
                : undefined
            );
            const el = parser.html(id, query, shortUrl);
            wrapperEl.appendChild(el);

            active = { parser, el };
            onChange(parser.getValue(el) as V);
          };

          ids.forEach(branchId => {
            siblings?.subscribe(branchId, () => {
              evaluate();
            });
          });
          evaluate();

          return wrapperEl;
        },
      };
    },
    cfg.label,
    cfg.title
  );
};
