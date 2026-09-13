import { tuple } from "niall-utils/core";
import { typedFromEntries, typedToEntries } from "niall-utils/data";
import { dom } from "niall-utils/ui";

import { valueParser } from "../../create.ts";
import { configItem } from "../../helpers.ts";
import type { AnyParserRecord, InitParserObject, Parser } from "../../types.ts";
import type { Config } from "../config.ts";
import { decodeFrames, encodeFrames } from "./frames.ts";

const childElement = (wrapperEl: Element, i: number): HTMLElement =>
  wrapperEl.children[i]?.lastElementChild as HTMLElement;

export interface GroupConfig<O extends AnyParserRecord> extends Config {
  children: InitParserObject<O>;
}

export const groupParser = <O extends AnyParserRecord>(cfg: GroupConfig<O>) => {
  const keys = typedToEntries(cfg.children).map(([key]) => key);

  return valueParser<O>(
    (onChange, getValue, externalCfg) => {
      let childParsers = {} as { [K in keyof O]: Parser<O[K]> };

      return {
        getValue: wrapperEl =>
          typedFromEntries(
            keys.map((key, i) =>
              tuple(key, childParsers[key].getValue(childElement(wrapperEl, i)))
            )
          ),
        updateValue: (wrapperEl, shortUrl) => {
          keys.forEach((key, i) => {
            childParsers[key].updateValue?.(
              childElement(wrapperEl, i),
              shortUrl
            );
          });
        },
        serialise: shortUrl =>
          encodeFrames(
            keys
              .map(key => childParsers[key])
              .filter(parser => parser.serialise != null)
              .map(parser => parser.serialise?.(shortUrl))
          ),
        html: (id, query, shortUrl) => {
          const built = typedToEntries(cfg.children).map(
            ([key, initParser]) => {
              const parser = initParser.methods(
                value => {
                  onChange({ ...getValue(), [key]: value });
                },
                () => getValue()[key],
                externalCfg != null
                  ? {
                      initial: externalCfg.initial?.[key] ?? null,
                      default: externalCfg.default[key],
                    }
                  : undefined
              );
              return tuple(key, parser, initParser);
            }
          );

          childParsers = typedFromEntries<{ [K in keyof O]: Parser<O[K]> }>(
            built.map(([key, parser]) => tuple(key, parser))
          );

          const frames = query != null ? decodeFrames(query) : [];
          let frameIdx = 0;

          const attrs = dom.toAttrs({
            ...(id != null && { id }),
            ...(cfg.title != null && { title: cfg.title }),
            ...cfg.attrs,
          });
          const wrapperEl = dom.toHtml(`<div ${attrs}></div>`);

          built.forEach(([key, parser, initParser]) => {
            const childQuery =
              parser.serialise != null ? (frames[frameIdx++] ?? null) : null;
            const childId = id != null ? `${id}-${String(key)}` : String(key);
            const el = parser.html(childId, childQuery, shortUrl);
            wrapperEl.appendChild(
              configItem(childId, el, initParser.label, initParser.title)
            );
          });

          return wrapperEl;
        },
      };
    },
    cfg.label,
    cfg.title
  );
};
