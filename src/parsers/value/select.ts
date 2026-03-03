import { isOneOf } from "deep-guards";
import { dom } from "niall-utils";

import { valueParser } from "../../create.ts";

import type { ValueConfig } from "../config.ts";

type SelectValue<A extends readonly [string, ...string[]]> = A[number];

export const selectParser = <const A extends readonly [string, ...string[]]>(
  cfg: ValueConfig<SelectValue<A>> & { options: A }
) => {
  const isOption = isOneOf(...cfg.options);
  const defaultValue = cfg.default ?? cfg.options[0];

  return valueParser<SelectValue<A>>(
    (onChange, getValue, externalCfg) => ({
      serialise: () =>
        getValue() !== (externalCfg?.default ?? defaultValue)
          ? getValue()
          : null,
      updateValue: el => {
        (el as HTMLSelectElement).value = getValue();
      },
      getValue: el => (el as HTMLSelectElement).value as SelectValue<A>,
      html: (id, query) => {
        const initial = isOption(query)
          ? query
          : isOption(externalCfg?.initial)
            ? externalCfg.initial
            : (externalCfg?.default ?? defaultValue);

        const attrs = dom.toAttrs({
          ...(id != null && { id }),
          ...cfg.attrs,
        });

        const opts = cfg.options.map(
          opt =>
            `<option value="${opt}"${opt === initial ? " selected" : ""}>${
              opt
            }</option>`
        );

        const el = dom.toHtml(`<select ${attrs}>${opts.join("")}</select>`);

        el.onchange = () => {
          onChange(el.value as SelectValue<A>);
        };

        return el;
      },
    }),
    cfg.label,
    cfg.title
  );
};
