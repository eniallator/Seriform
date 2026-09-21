import { dom } from "niall-utils/ui";

import { contentParser, type BaseConfig } from "../parser.ts";

export const imageContent = (cfg: BaseConfig) =>
  contentParser(cfg, (_onChange, _text, attrs) =>
    dom.toHtml(`<img ${attrs} />`)
  );
