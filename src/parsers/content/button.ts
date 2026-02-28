import { dom } from "niall-utils";

import { contentParser } from "../../create.ts";

import type { Config } from "../config.ts";

export const buttonParser = (cfg: Config & { text?: string }) =>
  contentParser((id, onChange) => {
    const attrs = dom.toAttrs({
      ...(id != null && { id }),
      ...(cfg.title != null && { title: cfg.title }),
      ...cfg.attrs,
    });

    const el = dom.toHtml(`<button ${attrs}>${cfg.text ?? ""}</button>`);
    el.onclick = onChange;
    return el;
  });
