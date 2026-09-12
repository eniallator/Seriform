import { tuple } from "niall-utils/core";
import { zip } from "niall-utils/data";
import { dom } from "niall-utils/ui";

import type { InitParser, Parser } from "../../types.ts";
import {
  collectionParser,
  type CollectionConfig,
  type NewRow,
} from "./base.ts";
import { formatField } from "./format.ts";

const getItemValues = <T extends NonNullable<unknown>>(
  baseEl: Element,
  allParsers: Parser<T>[],
  expandable: boolean
): T[] =>
  zip(allParsers, [
    ...baseEl.querySelectorAll<HTMLElement>(
      expandable ? "ul li > *:nth-child(2)" : "ul li > *"
    ),
  ]).map(([parser, itemEl]) => parser.getValue(itemEl));

const newRowFactory =
  <T extends NonNullable<unknown>>(
    initParser: InitParser<Parser<T>>,
    expandable: boolean
  ): NewRow<T, Parser<T>> =>
  ({
    queryItems,
    initial = null,
    defaultValue,
    getValue,
    onChange,
    shortUrl,
  }) => {
    const itemEl = dom.toHtml(
      `<li>${expandable ? '<input data-selector type="checkbox" />' : ""}</li>`
    );

    const parser = initParser.methods(
      onChange,
      getValue,
      defaultValue != null ? { initial, default: defaultValue } : undefined
    );

    itemEl.appendChild(parser.html(null, queryItems?.[0] ?? null, shortUrl));

    return tuple(itemEl, parser);
  };

export interface ListConfig<
  T extends NonNullable<unknown>,
> extends CollectionConfig<T> {
  field: InitParser<Parser<T>>;
}

export const listParser = <const T extends NonNullable<unknown>>(
  cfg: ListConfig<T>
) =>
  collectionParser<T, Parser<T>>(cfg, {
    baseClass: "list",
    addLabel: "Add Item",
    deleteLabel: "Delete Selected",
    fieldsPerItem: 1,
    containerSelector: "ul",
    buildContentHtml: () => "<ul></ul>",
    newRow: newRowFactory(cfg.field, cfg.expandable ?? false),
    getValues: getItemValues,
    serialiseRow: (parser, shortUrl) =>
      formatField(parser.serialise?.(shortUrl)),
    isRowSelected: rowEl =>
      dom.get<HTMLInputElement>("[data-selector]", rowEl).checked,
  });
