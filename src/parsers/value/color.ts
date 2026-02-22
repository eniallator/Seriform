import { base64FromUint, base64ToUint, dom, isValidBase64 } from "niall-utils";

import { valueParser } from "../../create.ts";

import type { ValueConfig } from "../../types.ts";

export const colorParser = (cfg: ValueConfig<string>) => {
  const defaultValue = cfg.default ?? "000000";
  return valueParser<string>(
    (onChange, getValue, externalCfg) => ({
      default: defaultValue,
      serialise: shortUrl =>
        getValue() ===
        (externalCfg != null ? externalCfg.default : defaultValue)
          ? null
          : shortUrl
            ? base64FromUint(Math.abs(Number.parseInt(getValue(), 16)))
            : getValue(),
      updateValue: el => {
        (el as HTMLInputElement).value = `#${getValue()}`;
      },
      getValue: el => (el as HTMLInputElement).value.slice(1).toLowerCase(),
      html: (id, query, shortUrl) => {
        const initial =
          query != null
            ? shortUrl && isValidBase64(query)
              ? base64ToUint(query).toString(16)
              : query.toLowerCase()
            : (externalCfg?.initial ?? externalCfg?.default ?? defaultValue);

        const attrs = dom.toAttrs({
          ...(id != null && { id }),
          value: `#${initial}`,
          ...cfg.attrs,
        });

        const el = dom.toHtml(`<input type="color" ${attrs} />`);
        el.oninput = () => {
          onChange(el.value.slice(1).toLowerCase());
        };
        return el;
      },
    }),
    cfg.label,
    cfg.title
  );
};
