import { dom } from "niall-utils/ui";

import { valueParser } from "../../parser.ts";
import type { ValueConfig } from "../config.ts";

export const defaultNumber = (
  attrs?: Record<string, string | number | null>
) => {
  const min = Number(attrs?.["min"] ?? 0);
  const max = Number(attrs?.["max"] ?? 100);
  const step = Number(attrs?.["step"] ?? 1);

  return Math.ceil((max - min) / step) * step + min;
};

export const numToStr = (n: number) =>
  [n, n.toExponential()]
    .map(encodeURIComponent)
    .reduce((a, b) => (a.length < b.length ? a : b));

export const numberParser = (cfg: ValueConfig<number>) => {
  const defaultValue =
    cfg.default ?? (cfg.attrs != null ? defaultNumber(cfg.attrs) : 0);

  return valueParser<number>(
    ({ onChange, getValue, externalCfg }) => ({
      serialise: () =>
        getValue() === (externalCfg?.default ?? defaultValue)
          ? null
          : numToStr(getValue()),
      getValue: el => Number((el as HTMLInputElement).value),
      updateValue: el => {
        (el as HTMLInputElement).value = `${getValue()}`;
      },
      html: (id, query) => {
        const initial =
          query != null
            ? Number(query)
            : (externalCfg?.initial ?? externalCfg?.default ?? defaultValue);

        const attrs = dom.toAttrs({
          ...(id != null && { id }),
          value: `${initial}`,
          ...cfg.attrs,
        });

        const el = dom.toHtml(`<input type="number" ${attrs} />`);

        el.onchange = () => {
          onChange(Number(el.value));
        };

        return el;
      },
    }),
    cfg.label,
    cfg.title
  );
};
