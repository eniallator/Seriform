import { isExact, isNumber, isString, isUnionOf } from "deep-guards";
import { mapFilter } from "niall-utils/functional";
import { dom } from "niall-utils/ui";

import { valueParser } from "../../create.ts";
import type { Config } from "../config.ts";
import { decodeFrames, encodeFrames } from "./frames.ts";

export interface NewRowParams<Item> {
  queryItems?: (string | null)[];
  initial?: Item | null;
  defaultValue?: Item;
  getValue: () => Item;
  onChange: (value: Item) => void;
  shortUrl: boolean;
}

export type NewRow<Item, Row> = (
  params: NewRowParams<Item>
) => readonly [Element, Row];

export interface CollectionConfig<Item> extends Config {
  expandable?: boolean;
  initialCollapsed?: boolean;
  default: Item[];
}

export interface CollectionAdapter<Item, Row> {
  /** Base CSS class for the outer wrapper, e.g. "list" | "table". */
  baseClass: string;
  /** Label for the "add" action button, e.g. "Add Item" | "Add Row". */
  addLabel: string;
  /** Label for the "delete" action button, e.g. "Delete Selected". */
  deleteLabel: string;
  /** Builds the markup that goes inside `<div class="content">…</div>` (the `<ul>` or `<table>`). */
  buildContentHtml: () => string;
  /** Selector, relative to the base element, whose children are one-per-row (e.g. "ul" | "tbody"). */
  containerSelector: string;
  newRow: NewRow<Item, Row>;
  getValues: (baseEl: Element, rows: Row[], expandable: boolean) => Item[];
  /** One serialised string per field in the row (null for a field with nothing to serialise). */
  serialiseRow: (row: Row, shortUrl: boolean) => (string | null)[];
  /** Reads whether a rendered row (a direct child of the container) is checked for deletion. */
  isRowSelected: (rowEl: Element) => boolean;
}

const when = (condition: boolean) => (str: string) => (condition ? str : "");

const DELETE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 448 512">
  <!--!Font Awesome Free 6.5.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.-->
  <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/>
</svg>`;

const ADD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 448 512">
  <!--!Font Awesome Free 6.5.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.-->
  <path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/>
</svg>`;

export const collectionParser = <Item extends NonNullable<unknown>, Row>(
  cfg: CollectionConfig<Item>,
  adapter: CollectionAdapter<Item, Row>
) => {
  const { expandable = false } = cfg;

  const { class: passedClass, ...rest } = cfg.attrs ?? {};
  const classValue = [
    adapter.baseClass,
    cfg.initialCollapsed && "collapsed",
    passedClass,
  ]
    .filter(isUnionOf(isString, isNumber))
    .join(" ");

  return valueParser<Item[]>((onChange, getValue, externalCfg) => {
    const isDefault = isExact(externalCfg?.default ?? cfg.default);
    let rows: Row[] = [];

    const rowParams =
      (shortUrl: boolean) =>
      (i: number): Omit<NewRowParams<Item>, "initial" | "queryItems"> => ({
        defaultValue: cfg.default[i],
        getValue: () => getValue()[i] as Item,
        onChange: value => onChange(getValue().with(i, value)),
        shortUrl,
      });

    const createRow =
      (containerEl: Element) =>
      (params: NewRowParams<Item>): Row => {
        const [rowEl, row] = adapter.newRow(params);
        containerEl.appendChild(rowEl);
        return row;
      };

    return {
      serialise: shortUrl =>
        isDefault(getValue())
          ? null
          : encodeFrames(
              rows.map(row => encodeFrames(adapter.serialiseRow(row, shortUrl)))
            ),
      getValue: el => adapter.getValues(el, rows, expandable),
      updateValue: (el, shortUrl) => {
        const containerEl = dom.get(adapter.containerSelector, el);
        containerEl.innerHTML = "";

        const create = createRow(containerEl);
        const params = rowParams(shortUrl);
        rows = getValue().map((initial, i) =>
          create({ initial, ...params(i) })
        );
      },
      html: (id, query, shortUrl) => {
        const attrs = dom.toAttrs({ id, class: classValue, ...rest });

        const baseEl = dom.toHtml(`
          <div ${attrs}>
            <a class="heading" href="javascript:return false"${when(cfg.title != null)(` title="${cfg.title}"`)}>
              <span class="label">${cfg.label ?? ""}</span>
              <span class="caret"></span>
            </a>
            <div class="container">
              <div class="content">
                ${adapter.buildContentHtml()}
              </div>
              ${when(expandable)(`
                <div class="actions">
                  <button type="button" data-action="delete">
                    <span class="width-large">${adapter.deleteLabel}</span>
                    <span class="width-narrow icon">${DELETE_ICON}</span>
                  </button>
                  <button type="button" data-action="add">
                    <span class="width-large">${adapter.addLabel}</span>
                    <span class="width-narrow icon">${ADD_ICON}</span>
                  </button>
                </div>
              `)}
            </div>
          </div>
        `);

        dom.addListener(dom.get(".heading", baseEl), "click", () => {
          baseEl.classList.toggle("collapsed");
        });
        const containerEl = dom.get(adapter.containerSelector, baseEl);
        const create = createRow(containerEl);
        const params = rowParams(shortUrl);

        const rowQueries = query != null ? decodeFrames(query) : [];

        rows =
          rowQueries.length === cfg.default.length ||
          (expandable && rowQueries.length > 0)
            ? rowQueries.map((rowQuery, i) =>
                create({
                  queryItems: rowQuery != null ? decodeFrames(rowQuery) : [],
                  ...params(i),
                })
              )
            : (externalCfg?.initial ?? externalCfg?.default ?? cfg.default).map(
                (initial, i) => create({ initial, ...params(i) })
              );

        if (expandable) {
          dom.get("button[data-action=delete]", baseEl).onclick = () => {
            const newValue = mapFilter([...containerEl.children], (el, i) =>
              adapter.isRowSelected(el) ? null : getValue()[i]
            );

            containerEl.innerHTML = "";
            rows = newValue.map((initial, i) =>
              create({ initial, ...params(i) })
            );

            onChange(newValue);
          };

          dom.get("button[data-action=add]", baseEl).onclick = () => {
            const idx = rows.length;
            const row = create(params(idx));

            rows.push(row);

            onChange(adapter.getValues(baseEl, rows, expandable));
          };
        }

        return baseEl;
      },
    };
  });
};
