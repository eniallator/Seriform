import {
  base64FromUint,
  base64ToUint,
  dom,
  formatLocaleDate,
  isValidBase64,
} from "niall-utils";

import { valueParser } from "../../create.ts";

import type { ValueConfig } from "../config.ts";

export const datetimeParser = (cfg: ValueConfig<Date>) => {
  const defaultValue = cfg.default ?? new Date(0);
  return valueParser<Date>(
    (onChange, getValue, externalCfg) => ({
      serialise: shortUrl =>
        getValue().getTime() ===
        (externalCfg?.default.getTime() ?? defaultValue.getTime())
          ? null
          : shortUrl
            ? base64FromUint(getValue().getTime())
            : getValue().toISOString(),
      updateValue: el => {
        (el as HTMLInputElement).value = formatLocaleDate(getValue());
      },
      getValue: el => new Date((el as HTMLInputElement).value),
      html: (id, query, shortUrl) => {
        const initial =
          query != null
            ? new Date(
                shortUrl && isValidBase64(query) ? base64ToUint(query) : query
              )
            : (externalCfg?.initial ?? externalCfg?.default ?? defaultValue);

        const attrs = dom.toAttrs({
          ...(id != null && { id }),
          value: formatLocaleDate(initial),
          ...cfg.attrs,
        });

        const el = dom.toHtml(`<input type="datetime-local" ${attrs} />`);

        el.onchange = () => {
          onChange(new Date(el.value));
        };

        return el;
      },
    }),
    cfg.label,
    cfg.title
  );
};
