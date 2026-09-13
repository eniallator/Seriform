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

/**
 * Renders `parser` (any parser - a plain value parser, a `groupParser` composing several, a
 * `list`/`table`, another conditional, ...) only while `condition` holds against its sibling's
 * live value; otherwise the field contributes no value at all, honestly reflected in the type as
 * `V | undefined` rather than lying via a `never` sentinel. `parser` is built once, up front, and
 * toggled via `hidden` rather than mounted/unmounted, so its in-progress input survives being
 * hidden and shown again.
 */
export const when = <
  Id extends string,
  T extends AnyParserValue,
  V extends AnyParserValue,
>(
  cfg: WhenConfig<Id, T, V>
) =>
  valueParser<V | undefined, Record<Id, T>>(
    (onChange, getValue, externalCfg, siblings) => {
      let visible = false;
      let childEl = null as unknown as HTMLElement;

      const child = cfg.parser.methods(
        value => {
          if (visible) onChange(value);
        },
        // Only read while `visible`, at which point the field has already reported a defined
        // `V` for this id via `onChange` below - safe to assert away the wrapper's `undefined`.
        () => getValue() as V,
        externalCfg?.default != null
          ? {
              initial: externalCfg.initial ?? null,
              default: externalCfg.default,
            }
          : undefined
      );

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
          childEl.hidden = true;
          wrapperEl.appendChild(childEl);

          siblings?.subscribe(cfg.condition.id, value => {
            const shouldShow = cfg.condition.test(value);
            if (shouldShow === visible) return;

            visible = shouldShow;
            childEl.hidden = !visible;
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
