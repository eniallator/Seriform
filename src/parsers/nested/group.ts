import { mapFilter } from "niall-utils";
import { tuple } from "niall-utils/core";
import { typedFromEntries, typedKeys, typedToEntries } from "niall-utils/data";
import { dom } from "niall-utils/ui";

import { valueParser } from "../../create.ts";
import { configItem, hashKey } from "../../helpers.ts";
import type { AnyParserRecord, InitParserObject, Parser } from "../../types.ts";
import type { Config } from "../config.ts";
import {
  decodeArray,
  decodeRecord,
  encodeArray,
  encodeRecord,
} from "./encoding.ts";

const childElement = (wrapperEl: Element, i: number): HTMLElement =>
  wrapperEl.children[i]?.lastElementChild as HTMLElement;

export interface GroupConfig<O extends AnyParserRecord> extends Config {
  children: InitParserObject<O>;
  hashLength?: number;
}

const encodeShortRecord = (entries: [string, string][]): string =>
  encodeArray(entries.map(([key, value]) => key + value));

const decodeShortRecord = (
  data: string,
  keyLength: number
): Record<string, string> =>
  Object.fromEntries(
    decodeArray(data).map(content =>
      tuple(content?.slice(0, keyLength) ?? "", content?.slice(keyLength) ?? "")
    )
  );

export const groupParser = <O extends AnyParserRecord>(cfg: GroupConfig<O>) => {
  const childKeys = typedKeys(cfg.children);
  const recordKey = (key: string, shortUrl: boolean): string =>
    shortUrl ? hashKey(key, cfg.hashLength ?? 2) : key;

  return valueParser<O>(
    ({ onChange, getValue, externalCfg }) => {
      let childParsers = {} as { [K in keyof O]: Parser<O[K]> };

      return {
        getValue: wrapperEl =>
          typedFromEntries(
            childKeys.map((key, i) =>
              tuple(key, childParsers[key].getValue(childElement(wrapperEl, i)))
            )
          ),
        updateValue: (wrapperEl, shortUrl) => {
          childKeys.forEach((key, i) => {
            childParsers[key].updateValue?.(
              childElement(wrapperEl, i),
              shortUrl
            );
          });
        },
        serialise: shortUrl => {
          const entries = mapFilter(childKeys, childKey => {
            const key = recordKey(childKey as string, shortUrl);
            const value = childParsers[childKey].serialise?.(shortUrl);
            return value != null ? tuple(key, value) : null;
          });

          return entries.length === 0
            ? null
            : shortUrl
              ? encodeShortRecord(entries)
              : encodeRecord(Object.fromEntries(entries));
        },
        html: (id, query, shortUrl) => {
          const built = typedToEntries(cfg.children).map(
            ([key, initParser]) => {
              const childId = id != null ? `${id}-${String(key)}` : String(key);
              const parser = initParser.methods({
                id: childId,
                onChange: value => {
                  onChange({ ...getValue(), [key]: value });
                },
                getValue: () => getValue()[key],
                externalCfg:
                  externalCfg != null
                    ? {
                        initial: externalCfg.initial?.[key] ?? null,
                        default: externalCfg.default[key],
                      }
                    : undefined,
              });
              return tuple(key, parser, initParser, childId);
            }
          );

          childParsers = typedFromEntries<{ [K in keyof O]: Parser<O[K]> }>(
            built.map(([key, parser]) => tuple(key, parser))
          );

          const record =
            query == null
              ? {}
              : shortUrl
                ? decodeShortRecord(query, cfg.hashLength ?? 2)
                : decodeRecord(query);

          const attrs = dom.toAttrs({
            ...(id != null && { id }),
            ...(cfg.title != null && { title: cfg.title }),
            ...cfg.attrs,
          });
          const wrapperEl = dom.toHtml(`<div ${attrs}></div>`);

          built.forEach(([key, parser, initParser, childId]) => {
            const childQuery =
              parser.serialise != null
                ? (record[recordKey(key as string, shortUrl)] ?? null)
                : null;
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
