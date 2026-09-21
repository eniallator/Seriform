import { isOneOf } from "deep-guards";
import { dom } from "niall-utils/ui";

import { hashKey } from "../../helpers.ts";
import { valueParser, type ValueConfig } from "../../parser.ts";

export interface SelectConfig<
  A extends readonly [string, ...string[]],
> extends ValueConfig<A[number]> {
  options: A;
  hashLength?: number;
}

export const selectParser = <const A extends readonly [string, ...string[]]>(
  cfg: SelectConfig<A>
) => {
  const isOption = isOneOf(...cfg.options);
  const defaultValue = cfg.default ?? cfg.options[0];
  const hashLength = cfg.hashLength ?? 2;

  return valueParser<A[number]>(
    ({ onChange, getValue, externalCfg }) => ({
      serialise: shortUrl =>
        getValue() === (externalCfg?.default ?? defaultValue)
          ? null
          : shortUrl
            ? hashKey(getValue(), hashLength)
            : getValue(),
      getValue: el => (el as HTMLSelectElement).value,
      updateValue: el => {
        (el as HTMLSelectElement).value = getValue();
      },
      html: (id, query, shortUrl) => {
        const matchedOption =
          shortUrl && query != null
            ? cfg.options.find(opt => hashKey(opt, hashLength) === query)
            : undefined;

        const initial =
          matchedOption ??
          (!shortUrl && isOption(query) ? query : undefined) ??
          (isOption(externalCfg?.initial)
            ? externalCfg.initial
            : (externalCfg?.default ?? defaultValue));

        const attrs = dom.toAttrs({ ...(id != null && { id }), ...cfg.attrs });

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
