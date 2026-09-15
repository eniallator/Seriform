import { dom } from "niall-utils/ui";

import { valueParser } from "../../create.ts";
import type { AnyParserValue, InitParser, Parser } from "../../types.ts";
import type { Config } from "../config.ts";
import type { Condition } from "./condition.ts";

export interface WhenConfig<
  Id extends string,
  T extends AnyParserValue,
  V extends AnyParserValue,
> extends Config {
  condition: Condition<Record<Id, T>>;
  parser: InitParser<Parser<V>>;
}

export const when = <
  Id extends string,
  T extends AnyParserValue,
  V extends AnyParserValue,
>(
  cfg: WhenConfig<Id, T, V>
) =>
  valueParser<V | undefined, { [K in Id]: T }>(
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

          siblings?.subscribe(cfg.condition.id, value => {
            const shouldShow = cfg.condition.test(value);
            if (shouldShow === visible) return;

            visible = shouldShow;
            wrapperEl.classList.toggle("hidden", !visible);
            onChange(visible ? child.getValue(childEl) : undefined);
          });

          return wrapperEl;
        },
      };
    },
    cfg.label,
    cfg.title
  );

export const unless = <
  Id extends string,
  T extends AnyParserValue,
  V extends AnyParserValue,
>(
  cfg: WhenConfig<Id, T, V>
) => when({ ...cfg, condition: cfg.condition.negate() });
