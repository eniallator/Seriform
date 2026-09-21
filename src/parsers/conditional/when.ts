import { dom } from "niall-utils/ui";

import { dependency, valueParser } from "../../create.ts";
import {
  subscribePath,
  type AnyDependencies,
  type Dependency,
  type Path,
} from "../../dependencies.ts";
import type { AnyParserValue, InitParser, Parser } from "../../types.ts";
import type { Config } from "../config.ts";
import type { Condition } from "./condition.ts";

export interface WhenConfig<
  T extends AnyParserValue,
  P extends Path,
  V extends AnyParserValue,
  ChildDeps extends AnyDependencies | undefined = AnyDependencies | undefined,
> extends Config {
  condition: Condition<T, P>;
  parser: InitParser<Parser<V>, ChildDeps>;
}

type WhenDeps<
  T,
  P extends Path,
  ChildDeps extends AnyDependencies | undefined,
> = readonly [
  Dependency<T, P>,
  ...(ChildDeps extends AnyDependencies ? ChildDeps : readonly []),
];

export const when = <
  T extends AnyParserValue,
  P extends Path,
  V extends AnyParserValue,
  const ChildDeps extends AnyDependencies | undefined = undefined,
>(
  cfg: WhenConfig<T, P, V, ChildDeps>
) =>
  valueParser<V | undefined, WhenDeps<T, P, ChildDeps>>(
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
            subscribePath(siblings, cfg.condition.path, value => {
              const shouldShow = cfg.condition.test(value as T);
              if (shouldShow === visible) return;

              visible = shouldShow;
              wrapperEl.classList.toggle("hidden", !visible);
              onChange(visible ? child.getValue(childEl) : undefined);
            });
          }

          return wrapperEl;
        },
      };
    },
    cfg.label,
    cfg.title,
    [
      dependency<T>()(...cfg.condition.path),
      ...(cfg.parser.deps ?? []),
    ] as unknown as WhenDeps<T, P, ChildDeps>
  );

export const unless = <
  T extends AnyParserValue,
  P extends Path,
  V extends AnyParserValue,
  const ChildDeps extends AnyDependencies | undefined = undefined,
>(
  cfg: WhenConfig<T, P, V, ChildDeps>
) => when({ ...cfg, condition: cfg.condition.negate() });
