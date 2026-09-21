import { dom } from "niall-utils/ui";

import type { AnyDependencies } from "../dependency.ts";
import { contentParser, type ContentConfig } from "../parser.ts";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export const headingContent = <
  const Deps extends AnyDependencies = readonly [],
>(
  cfg: ContentConfig<Deps> & { level?: HeadingLevel }
) =>
  contentParser(cfg, (_onChange, text, attrs) => {
    const tag = `h${cfg.level ?? 2}`;
    return dom.toHtml(`<${tag} ${attrs}>${text}</${tag}>`);
  });
