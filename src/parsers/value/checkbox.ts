import { isOneOf } from "deep-guards";
import { dom } from "niall-utils";

import { valueParser } from "../../create.ts";

import type { ValueConfig } from "../config.ts";

export const checkboxParser = (cfg: ValueConfig<boolean>) => {
  const defaultValue = cfg.default ?? false;
  return valueParser<boolean>(
    (onChange, getValue, externalCfg) => ({
      serialise: shortUrl =>
        getValue() !== (externalCfg?.default ?? defaultValue)
          ? `${shortUrl ? +getValue() : getValue()}`
          : null,
      updateValue: el => {
        el.toggleAttribute("checked", getValue());
      },
      getValue: el => el.hasAttribute("checked"),
      html: (id, query) => {
        const initial =
          query != null
            ? isOneOf("1", "true")(query)
            : (externalCfg?.initial ?? externalCfg?.default ?? defaultValue);

        const attrs = dom.toAttrs({
          ...(id != null && { id }),
          ...(initial && { checked: null }),
          ...cfg.attrs,
        });

        const el = dom.toHtml(`<input type="checkbox" ${attrs} />`);

        el.onchange = () => {
          onChange(el.checked);
        };

        return el;
      },
    }),
    cfg.label,
    cfg.title
  );
};
