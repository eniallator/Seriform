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

type BranchValue<B> = B extends IfBranch<any, infer V> ? V : never;

type MergeRecords<U extends AnyParserRecord> = {
  [K in U extends unknown ? keyof U : never]: U extends Record<K, infer V>
    ? V
    : never;
};
type BranchesCfg<Branches extends AnyBranches> =
  Branches[number]["condition"] extends Condition<infer Cfg>
    ? MergeRecords<Cfg>
    : never;

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

  const branches = cfg.branches
    .map<{
      id: Id | null;
      test: ((value: AnyParserValue) => boolean) | null;
      parser: InitParser<Parser<AnyParserValue>>;
    }>(branch => ({
      id: branch.condition.id,
      test: branch.condition.test,
      parser: branch.parser,
    }))
    .concat([{ id: null, test: null, parser: cfg.otherwise }]);
  const ids = new Set(cfg.branches.map(branch => branch.condition.id as Id));

  return valueParser<V, BranchesCfg<Branches>>(
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
                ? branches.length - 1
                : branches.findIndex(
                    ({ id, test }) =>
                      id != null && test?.(siblings.getValue(id))
                  );
            if (index === activeIndex) return;
            activeIndex = index;

            wrapperEl.innerHTML = "";

            const init = branches.at(index)?.parser ?? cfg.otherwise;
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
