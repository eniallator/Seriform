import { dom } from "niall-utils/ui";

import {
  getPath,
  subscribePath,
  type AnyDependencies,
} from "../../dependency.ts";
import type { Derived } from "../../derived.ts";
import {
  valueParser,
  type BaseConfig,
  type InitParser,
  type Parser,
} from "../../parser.ts";
import type { AnyParserValue } from "../../types.ts";

export interface IfBranch<
  Deps extends AnyDependencies = AnyDependencies,
  V extends AnyParserValue = AnyParserValue,
  ChildDeps extends AnyDependencies | undefined = AnyDependencies | undefined,
> {
  condition: Derived<boolean, Deps>;
  parser: InitParser<Parser<V>, ChildDeps>;
}

export type AnyBranches = readonly [IfBranch, ...IfBranch[]];

export interface IfConfig<
  Branches extends AnyBranches,
  Otherwise extends AnyParserValue,
  OtherwiseDeps extends AnyDependencies | undefined =
    AnyDependencies | undefined,
> extends BaseConfig {
  branches: Branches;
  otherwise: InitParser<Parser<Otherwise>, OtherwiseDeps>;
}

type BranchValue<B> = B extends IfBranch<any, infer V, any> ? V : never;

/** A single branch's own contribution to `ifParser`'s aggregate deps: its condition's deps,
 * plus whatever its own child parser (possibly itself a container) still has pending. */
type BranchDeps<B> =
  B extends IfBranch<infer Deps, any, infer ChildDeps>
    ? readonly [
        ...Deps,
        ...(ChildDeps extends AnyDependencies ? ChildDeps : readonly []),
      ]
    : readonly [];

type AllBranchDeps<Branches extends readonly IfBranch[]> =
  Branches extends readonly [
    infer Head extends IfBranch,
    ...infer Rest extends readonly IfBranch[],
  ]
    ? readonly [...BranchDeps<Head>, ...AllBranchDeps<Rest>]
    : readonly [];

type IfDeps<
  Branches extends AnyBranches,
  OtherwiseDeps extends AnyDependencies | undefined,
> = readonly [
  ...AllBranchDeps<Branches>,
  ...(OtherwiseDeps extends AnyDependencies ? OtherwiseDeps : readonly []),
];

export const ifParser = <
  const Branches extends AnyBranches,
  Otherwise extends AnyParserValue,
  const OtherwiseDeps extends AnyDependencies | undefined = undefined,
>(
  cfg: IfConfig<Branches, Otherwise, OtherwiseDeps>
) => {
  type V = BranchValue<Branches[number]> | Otherwise;

  const branches = cfg.branches.map(branch => ({
    deps: branch.condition.deps,
    test: branch.condition.derive,
    parser: branch.parser,
  }));

  const parser = valueParser<V, IfDeps<Branches, OtherwiseDeps>>(
    ({ onChange, getValue, externalCfg, siblings }) => {
      let activeIndex: number | null = null;
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
                ? -1
                : branches.findIndex(({ deps, test }) =>
                    test(...deps.map(dep => getPath(siblings, dep.path)))
                  );
            if (index === activeIndex) return;
            activeIndex = index;

            wrapperEl.innerHTML = "";

            const init = branches[index]?.parser ?? cfg.otherwise;
            const parser = init.methods({
              id,
              onChange: value => {
                onChange(value as V);
              },
              getValue,
              externalCfg:
                externalCfg?.default != null
                  ? {
                      initial: externalCfg.initial ?? null,
                      default: externalCfg.default,
                    }
                  : undefined,
            });
            const el = parser.html(id, query, shortUrl);
            wrapperEl.appendChild(el);

            active = { parser, el };
            onChange(parser.getValue(el) as V);
          };

          if (siblings != null) {
            const seen = new Set<string>();
            branches.forEach(({ deps }) => {
              deps.forEach(dep => {
                const key = JSON.stringify(dep.path);
                if (seen.has(key)) return;
                seen.add(key);

                subscribePath(siblings, dep.path, () => {
                  evaluate();
                });
              });
            });
          }
          evaluate();

          return wrapperEl;
        },
      };
    },
    cfg.label,
    cfg.title,
    cfg.branches
      .flatMap(branch => branch.condition.deps.concat(branch.parser.deps ?? []))
      .concat(cfg.otherwise.deps ?? []) as unknown as IfDeps<
      Branches,
      OtherwiseDeps
    >
  );

  return parser;
};
