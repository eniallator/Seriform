import { dom } from "niall-utils";

import { contentParser } from "../../create.ts";

import type { Config } from "../../types.ts";

export const buttonParser = (cfg: Config & { text?: string }) =>
  contentParser((id, onChange) => {
    const { class: passedClass, ...rest } = cfg.attrs ?? {};
    const classValue =
      "primary wrap-text" + (passedClass != null ? ` ${passedClass}` : "");

    const attrs = dom.toAttrs({
      ...(id != null && { id }),
      ...(cfg.title != null && { title: cfg.title }),
      class: classValue,
      ...rest,
    });

    const el = dom.toHtml(`<button ${attrs}>${cfg.text ?? ""}</button>`);
    el.onclick = onChange;
    return el;
  });
