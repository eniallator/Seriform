import { isExact, isNumber, isString, isUnionOf } from "deep-guards";
import { dom, mapFilter, tuple, zip } from "niall-utils";

import { valueParser } from "../../create.ts";

import type { InitParser, ValueParser } from "../../types.ts";
import type { Config } from "../config.ts";
import { formatField, splitQueryValues } from "./format.ts";

type ValueParsers<O extends readonly unknown[]> = {
  [K in keyof O]: ValueParser<O[K]>;
};

type InitValueParsers<O extends readonly unknown[]> = {
  [K in keyof O]: InitParser<ValueParser<O[K]>>;
};

type FieldValues = readonly [unknown, ...unknown[]];

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

interface NewRowParams<F extends FieldValues> {
  queryItems?: (string | null)[];
  initialItems?: F;
  itemDefaults?: F;
  getValue: () => F;
  onChange: (value: F) => void;
  shortUrl: boolean;
}

const newRowFactory =
  <F extends FieldValues>(
    initParsers: InitValueParsers<F>,
    expandable: boolean
  ) =>
  ({
    queryItems,
    initialItems,
    itemDefaults,
    getValue,
    onChange,
    shortUrl,
  }: NewRowParams<F>) => {
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
        () => getValue()[i],
        itemDefaults?.[i] != null
          ? { initial: initialItems?.[i] ?? null, default: itemDefaults[i] }
          : undefined
      );

      const td = document.createElement("td");
      td.appendChild(parser.html(null, queryItems?.[i] ?? null, shortUrl));
      rowEl.appendChild(td);

      return parser;
    }) as ValueParsers<F>;

    return tuple(rowEl, parsers);
  };

interface TableConfig<F extends FieldValues> extends Config {
  expandable?: boolean;
  initialCollapsed?: boolean;
  fields: InitValueParsers<F>;
  default: NoInfer<F>[];
}

export const tableParser = <const F extends FieldValues>(
  cfg: TableConfig<F>
) => {
  const { expandable = false } = cfg;
  const newRow = newRowFactory(cfg.fields, expandable);

  const { class: passedClass, ...rest } = cfg.attrs ?? {};
  const classValue = ["table", cfg.initialCollapsed && "collapsed", passedClass]
    .filter(isUnionOf(isString, isNumber))
    .join(" ");

  return valueParser<F[]>((onChange, getValue, externalCfg) => {
    const isDefault = isExact(externalCfg?.default ?? cfg.default);
    let fieldParsers: ValueParsers<F>[] = [];

    return {
      serialise: shortUrl =>
        isDefault(getValue())
          ? null
          : fieldParsers
              .map(row =>
                row
                  .map(parser => formatField(parser.serialise(shortUrl)))
                  .join(",")
              )
              .join(","),
      getValue: el => getRowValues(el, fieldParsers, expandable),
      updateValue: (el, shortUrl) => {
        const container = dom.get("tbody", el);
        container.innerHTML = "";

        fieldParsers = getValue()
          .map((initialItems, i) =>
            newRow({
              initialItems,
              itemDefaults: cfg.default[i],
              getValue: () => getValue()[i] as F,
              onChange: value => {
                onChange(getValue().with(i, value));
              },
              shortUrl,
            })
          )
          .map(([rowEl, parsers]) => {
            container.appendChild(rowEl);
            return parsers;
          });
      },
      html: (id, query, shortUrl) => {
        const when = (condition: boolean) => (str: string) =>
          condition ? str : "";
        const colHtml = (title?: string, label?: string) =>
          `<th scope="col"${when(title != null)(` title="${title}"`)}>${label ?? ""}</th>`;

        const attrs = dom.toAttrs({ id, class: classValue, ...rest });

        const baseEl = dom.toHtml(`
          <div ${attrs}>
            <a class="heading" href="javascript:return false"${when(cfg.title != null)(` title="${cfg.title}"`)}>
              <span class="label">${cfg.label ?? ""}</span>
              <span class="caret"></span>
            </a>
            <div class="container">
              <div class="content">
                <table>
                  <thead>
                    <tr>
                      ${when(expandable)(colHtml("row-select"))}
                      ${cfg.fields.map(({ title, label }) => colHtml(title, label)).join("")}
                    </tr>
                  </thead>
                  <tbody></tbody>
                </table>
              </div>
              ${when(expandable)(`
                <div class="actions">
                  <button type="button" data-action="delete">
                    <span class="width-large">Delete Selected</span>
                    <span class="width-narrow icon">
                      <svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 448 512">
                        <!--!Font Awesome Free 6.5.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.-->
                        <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/>
                      </svg>
                    </span>
                  </button>
                  <button type="button" data-action="add">
                    <span class="width-large">Add Row</span>
                    <span class="width-narrow icon">
                      <svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 448 512">
                        <!--!Font Awesome Free 6.5.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.-->
                        <path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/>
                      </svg>
                    </span>
                  </button>
                </div>
              `)}
            </div>
          </div>
        `);

        dom.addListener(dom.get(".heading", baseEl), "click", () => {
          baseEl.classList.toggle("collapsed");
        });

        const bodyEl = dom.get("tbody", baseEl);
        const flatQueryValues = query != null ? splitQueryValues(query) : [];

        const numFields = cfg.fields.length;
        const numQueryValues = Math.floor(flatQueryValues.length / numFields);
        const queryValues = [...new Array<undefined>(numQueryValues)].map(
          (_, i) => flatQueryValues.slice(i * numFields, (i + 1) * numFields)
        );
        const fieldValues =
          numQueryValues === cfg.default.length ||
          (expandable && queryValues.length > 0)
            ? queryValues
            : (externalCfg?.initial ?? externalCfg?.default ?? cfg.default);

        fieldParsers = fieldValues.map((_, i) => {
          const [el, parsers] = newRow({
            queryItems: queryValues[i],
            itemDefaults: cfg.default[i],
            getValue: () => getValue()[i] as F,
            onChange: newRow => {
              onChange(getValue().with(i, newRow));
            },
            shortUrl,
          });

          bodyEl.appendChild(el);

          return parsers;
        });

        if (expandable) {
          dom.get("button[data-action=delete]", baseEl).onclick = () => {
            const newValue = mapFilter([...bodyEl.children], (el, i) => {
              if (dom.get<HTMLInputElement>("[data-selector]", el).checked) {
                el.remove();
                return null;
              }

              return getValue()[i] as F;
            });

            fieldParsers = newValue.map((initial, i) => {
              const [_el, parsers] = newRow({
                initialItems: initial,
                itemDefaults: cfg.default[i],
                getValue: () => getValue()[i] as F,
                onChange: value => {
                  onChange(getValue().with(i, value));
                },
                shortUrl,
              });
              return parsers;
            });

            onChange(newValue);
          };

          dom.get("button[data-action=add]", baseEl).onclick = () => {
            const idx = fieldParsers.length;
            const [el, parsers] = newRow({
              itemDefaults: cfg.default[idx],
              getValue: () => getValue()[idx] as F,
              onChange: value => {
                onChange(getValue().with(idx, value));
              },
              shortUrl,
            });

            bodyEl.appendChild(el);

            fieldParsers.push(parsers);

            onChange(getRowValues(baseEl, fieldParsers, expandable));
          };
        }

        return baseEl;
      },
    };
  });
};
