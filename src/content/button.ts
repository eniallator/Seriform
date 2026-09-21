import { dom } from "niall-utils/ui";

import type { AnyDependencies } from "../dependency.ts";
import { contentParser, type ContentConfig } from "../parser.ts";

export const buttonContent = <const Deps extends AnyDependencies = readonly []>(
  cfg: ContentConfig<Deps>
) =>
  contentParser(cfg, (onChange, text, attrs) => {
    const el = dom.toHtml(`<button ${attrs}>${text}</button>`);
    el.onclick = onChange;
    return el;
  });
