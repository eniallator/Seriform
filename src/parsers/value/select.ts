import { isOneOf } from "deep-guards";
import { dom } from "niall-utils";

import { valueParser } from "../../create.ts";
import type { ValueConfig } from "../config.ts";

export const selectParser = <const A extends readonly [string, ...string[]]>(
  cfg: ValueConfig<A[number]> & { options: A }
) => {
  const isOption = isOneOf(...cfg.options);
  const defaultValue = cfg.default ?? cfg.options[0];

  return valueParser<A[number]>(
    (onChange, getValue, externalCfg) => ({
      serialise: () =>
        getValue() === (externalCfg?.default ?? defaultValue)
          ? null
          : getValue(),
      getValue: el => (el as HTMLSelectElement).value,
      updateValue: el => {
        (el as HTMLSelectElement).value = getValue();
      },
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
          opt => `<option value="${opt}">${opt}</option>`
        );

        const el = dom.toHtml(`<select ${attrs}>${opts.join("")}</select>`);
        el.value = initial;

        el.onchange = () => {
          onChange(el.value);
        };

        return el;
      },
    }),
    cfg.label,
    cfg.title
  );
};
