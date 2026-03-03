import { dom } from "niall-utils";

import { valueParser } from "../../create.ts";

import type { ValueConfig } from "../config.ts";

export const textParser = (cfg: ValueConfig<string> & { area?: boolean }) => {
  return valueParser<string>(
    (onChange, getValue, externalCfg) => ({
      serialise: () =>
        getValue() !== (externalCfg?.default ?? cfg.default)
          ? getValue()
          : null,
      updateValue: el => {
        (el as HTMLInputElement | HTMLTextAreaElement).value = getValue();
      },
      getValue: el => (el as HTMLInputElement | HTMLTextAreaElement).value,
      html: (id, query) => {
        const initial =
          query ??
          externalCfg?.initial ??
          externalCfg?.default ??
          cfg.default ??
          "";

        const attrs = dom.toAttrs({
          ...(id != null && { id }),
          ...cfg.attrs,
        });

        const el = dom.toHtml(
          cfg.area
            ? `<textarea ${attrs}>${initial}</textarea>`
            : `<input type="text" value="${initial}" ${attrs} />`
        );

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
