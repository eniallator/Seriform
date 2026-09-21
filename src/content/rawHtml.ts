import { dom } from "niall-utils/ui";

import { contentParser, type BaseConfig } from "../parser.ts";

export const rawHtmlContent = (cfg: BaseConfig & { html: string }) =>
  contentParser(cfg, (_onChange, _text, attrs) => {
    const el = dom.toHtml(`<div ${attrs}></div>`);
    el.innerHTML = cfg.html;
    return el;
  });
