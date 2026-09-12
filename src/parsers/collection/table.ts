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

type ValueParsers<O extends readonly NonNullable<unknown>[]> = {
  [K in keyof O]: Parser<O[K]>;
};

type InitValueParsers<O extends readonly NonNullable<unknown>[]> = {
  [K in keyof O]: InitParser<Parser<O[K]>>;
};

type FieldValues = readonly [NonNullable<unknown>, ...NonNullable<unknown>[]];

const getRowValues = <F extends FieldValues>(
  baseEl: Element,
  allParsers: ValueParsers<F>[],
  expandable: boolean
): F[] =>
  zip(allParsers, [...baseEl.querySelectorAll("tbody tr")]).map(
    ([parsers, rowEl]) => {
      const itemEls = rowEl.querySelectorAll<HTMLElement>("td > *");
      return parsers.map((parser, i) =>
        parser.getValue(itemEls.item(i + Number(expandable)))
      ) as unknown as F;
    }
  );

const newRowFactory =
  <F extends FieldValues>(
    initParsers: InitValueParsers<F>,
    expandable: boolean
  ): NewRow<F, ValueParsers<F>> =>
  ({ queryItems, initial, defaultValue, getValue, onChange, shortUrl }) => {
    const rowEl = dom.toHtml(
      `<tr>${
        expandable ? '<td><input data-selector type="checkbox" /></td>' : ""
      }</tr>`
    );

    const parsers = initParsers.map(({ methods }, i) => {
      const parser = methods(
        (value: F[number]) => {
          onChange(getValue().with(i, value) as unknown as F);
        },
        () => getValue()[i] as F[number],
        defaultValue?.[i] != null
          ? { initial: initial?.[i] ?? null, default: defaultValue[i] }
          : undefined
      );

      const td = document.createElement("td");
      td.appendChild(parser.html(null, queryItems?.[i] ?? null, shortUrl));
      rowEl.appendChild(td);

      return parser;
    }) as ValueParsers<F>;

    return tuple(rowEl, parsers);
  };

export interface TableConfig<
  F extends FieldValues,
> extends CollectionConfig<F> {
  fields: InitValueParsers<F>;
  default: NoInfer<F>[];
}

export const tableParser = <const F extends FieldValues>(
  cfg: TableConfig<F>
) => {
  const expandable = cfg.expandable ?? false;

  const colHtml = (title?: string, label: string = "") =>
    `<th scope="col"${title != null ? ` title="${title}"` : ""}>${label}</th>`;

  return collectionParser<F, ValueParsers<F>>(cfg, {
    baseClass: "table",
    addLabel: "Add Row",
    deleteLabel: "Delete Selected",
    fieldsPerItem: cfg.fields.length,
    containerSelector: "tbody",
    buildContentHtml: () => `
      <table>
        <thead>
          <tr>
            ${expandable ? colHtml("row-select") : ""}
            ${cfg.fields.map(({ title, label }) => colHtml(title, label)).join("")}
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    `,
    newRow: newRowFactory(cfg.fields, expandable),
    getValues: getRowValues,
    serialiseRow: (row, shortUrl) =>
      row.map(parser => formatField(parser.serialise?.(shortUrl))).join(","),
    isRowSelected: rowEl =>
      dom.get<HTMLInputElement>("[data-selector]", rowEl).checked,
  });
};
