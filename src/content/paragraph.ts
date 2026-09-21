import { dom } from "niall-utils/ui";

import type { AnyDependencies } from "../dependency.ts";
import { contentParser, type ContentConfig } from "../parser.ts";

export const paragraphContent = <
  const Deps extends AnyDependencies = readonly [],
>(
  cfg: ContentConfig<Deps>
) =>
  contentParser(cfg, (_onChange, text, attrs) =>
    dom.toHtml(`<p ${attrs}>${text}</p>`)
  );
