import { dom } from "niall-utils/ui";

import { valueParser, type ValueConfig } from "../../parser.ts";

export const textParser = (cfg: ValueConfig<string> & { area?: boolean }) => {
  const defaultValue = cfg.default ?? "";

  return valueParser<string>(
    ({ onChange, getValue, externalCfg }) => ({
      serialise: () =>
        getValue() === (externalCfg?.default ?? defaultValue)
          ? null
          : getValue(),
      getValue: el => (el as HTMLInputElement | HTMLTextAreaElement).value,
      updateValue: el => {
        (el as HTMLInputElement | HTMLTextAreaElement).value = getValue();
      },
      html: (id, query) => {
        const initial =
          query ?? externalCfg?.initial ?? externalCfg?.default ?? defaultValue;

        const attrs = dom.toAttrs({ ...(id != null && { id }), ...cfg.attrs });

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
