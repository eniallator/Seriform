import { dom } from "niall-utils/ui";

import {
  getPath,
  subscribePath,
  type AnyDependencies,
} from "../../dependency.ts";
import { negate, type Derived } from "../../derived.ts";
import { valueParser } from "../../parser.ts";
import type { AnyParserValue, InitParser, Parser } from "../../types.ts";
import type { Config } from "../config.ts";

export interface WhenConfig<
  Deps extends AnyDependencies,
  V extends AnyParserValue,
  ChildDeps extends AnyDependencies | undefined = AnyDependencies | undefined,
> extends Config {
  condition: Derived<boolean, Deps>;
  parser: InitParser<Parser<V>, ChildDeps>;
}

type WhenDeps<
  Deps extends AnyDependencies,
  ChildDeps extends AnyDependencies | undefined,
> = readonly [
  ...Deps,
  ...(ChildDeps extends AnyDependencies ? ChildDeps : readonly []),
];

export const when = <
  const Deps extends AnyDependencies,
  V extends AnyParserValue,
  const ChildDeps extends AnyDependencies | undefined = undefined,
>(
  cfg: WhenConfig<Deps, V, ChildDeps>
) =>
  valueParser<V | undefined, WhenDeps<Deps, ChildDeps>>(
    ({ id, onChange, getValue, externalCfg, siblings }) => {
      let visible = false;
      let childEl = null as unknown as HTMLElement;

      const child = cfg.parser.methods({
        id,
        onChange: value => {
          if (visible) onChange(value);
        },
        getValue: () => getValue() as V,
        externalCfg:
          externalCfg?.default != null
            ? {
                initial: externalCfg.initial ?? null,
                default: externalCfg.default,
              }
            : undefined,
      });

      return {
        getValue: () => (visible ? child.getValue(childEl) : undefined),
        updateValue: (_wrapperEl, shortUrl) => {
          child.updateValue?.(childEl, shortUrl);
        },
        serialise: shortUrl =>
          visible ? (child.serialise?.(shortUrl) ?? null) : null,
        html: (id, query, shortUrl) => {
          const attrs = dom.toAttrs({
            ...(id != null && { id }),
            ...(cfg.title != null && { title: cfg.title }),
            ...cfg.attrs,
          });
          const wrapperEl = dom.toHtml(`<div ${attrs}></div>`);

          childEl = child.html(id, query, shortUrl);
          wrapperEl.appendChild(childEl);
          wrapperEl.classList.toggle("hidden", !visible);

          if (siblings != null) {
            const update = (): void => {
              const shouldShow = cfg.condition.derive(
                ...cfg.condition.deps.map(dep => getPath(siblings, dep.path))
              );
              if (shouldShow === visible) return;

              visible = shouldShow;
              wrapperEl.classList.toggle("hidden", !visible);
              onChange(visible ? child.getValue(childEl) : undefined);
            };

            cfg.condition.deps.forEach(dep => {
              subscribePath(siblings, dep.path, update);
            });
          }

          return wrapperEl;
        },
      };
    },
    cfg.label,
    cfg.title,
    [...cfg.condition.deps, ...(cfg.parser.deps ?? [])] as unknown as WhenDeps<
      Deps,
      ChildDeps
    >
  );

export const unless = <
  const Deps extends AnyDependencies,
  V extends AnyParserValue,
  const ChildDeps extends AnyDependencies | undefined = undefined,
>(
  cfg: WhenConfig<Deps, V, ChildDeps>
) => when({ ...cfg, condition: negate(cfg.condition) });
