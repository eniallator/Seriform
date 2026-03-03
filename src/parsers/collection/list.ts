import { isExact, isNumber, isString, isUnionOf } from "deep-guards";
import { dom, mapFilter, tuple, zip } from "niall-utils";

import { valueParser } from "../../create.ts";
import { formatField, splitQueryValues } from "./format.ts";

import type { InitParser, ValueParser } from "../../types.ts";
import type { Config } from "../config.ts";

const getItemValues = <T>(
  baseEl: Element,
  allParsers: ValueParser<T>[],
  expandable: boolean
): T[] =>
  zip(allParsers, [
    ...baseEl.querySelectorAll<HTMLElement>(
      expandable ? "ul li > *:nth-child(2)" : "ul li > *"
    ),
  ]).map(([parser, itemEl]) => parser.getValue(itemEl));

interface NewItemParams<T> {
  query?: string | null;
  initial?: T | null;
  defaultValue?: T;
  getValue: () => T;
  onChange: (value: T) => void;
  shortUrl: boolean;
}

const newRowFactory =
  <T>(initParser: InitParser<ValueParser<T>>, expandable: boolean) =>
  ({
    query = null,
    initial = null,
    defaultValue,
    getValue,
    onChange,
    shortUrl,
  }: NewItemParams<T>) => {
    const itemEl = dom.toHtml(
      `<li>${expandable ? '<input data-selector type="checkbox" />' : ""}</li>`
    );

    const parser = initParser.methods(
      onChange,
      getValue,
      defaultValue != null ? { initial, default: defaultValue } : undefined
    );

    itemEl.appendChild(parser.html(null, query, shortUrl));

    return tuple(itemEl, parser);
  };

interface ListConfig<T> extends Config {
  expandable?: boolean;
  initialCollapsed?: boolean;
  field: InitParser<ValueParser<T>>;
  default: T[];
}

export const listParser = <const T>(cfg: ListConfig<T>) => {
  const { expandable = false } = cfg;
  const newRow = newRowFactory(cfg.field, expandable);

  const { class: passedClass, ...rest } = cfg.attrs ?? {};
  const classValue = ["list", cfg.initialCollapsed && "collapsed", passedClass]
    .filter(isUnionOf(isString, isNumber))
    .join(" ");

  return valueParser<T[]>((onChange, getValue, externalCfg) => {
    const isDefault = isExact(externalCfg?.default ?? cfg.default);
    let parsers: ValueParser<T>[] = [];

    return {
      serialise: shortUrl =>
        isDefault(getValue())
          ? null
          : parsers
              .map(parser => formatField(parser.serialise(shortUrl)))
              .join(","),
      getValue: el => getItemValues(el, parsers, expandable),
      updateValue: (el, shortUrl) => {
        const listEl = dom.get("ul", el);
        listEl.innerHTML = "";

        parsers = getValue()
          .map((initial, i) =>
            newRow({
              initial,
              defaultValue: cfg.default[i],
              getValue: () => getValue()[i] as T,
              onChange: value => {
                onChange(getValue().with(i, value));
              },
              shortUrl,
            })
          )
          .map(([rowEl, parsers]) => {
            listEl.appendChild(rowEl);
            return parsers;
          });
      },
      html: (id, query, shortUrl) => {
        const when = (condition: boolean) => (str: string) =>
          condition ? str : "";

        const attrs = dom.toAttrs({ id, class: classValue, ...rest });

        const baseEl = dom.toHtml(`
          <div ${attrs}>
            <a class="heading" href="javascript:return false"${when(cfg.title != null)(` title="${cfg.title}"`)}>
              <span class="label">${cfg.label ?? ""}</span>
              <span class="caret"></span>
            </a>
            <div class="container">
              <div class="content">
                <ul></ul>
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
                    <span class="width-large">Add Item</span>
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
        const listEl = dom.get("ul", baseEl);

        const queryValues = query != null ? splitQueryValues(query) : [];
        const parserValues =
          queryValues.length === cfg.default.length ||
          (expandable && queryValues.length > 0)
            ? queryValues
            : (externalCfg?.initial ?? externalCfg?.default ?? cfg.default);

        parsers = parserValues.map((_, i) => {
          const [el, parser] = newRow({
            query: queryValues[i],
            defaultValue: cfg.default[i],
            getValue: () => getValue()[i] as T,
            onChange: value => {
              onChange(getValue().with(i, value));
            },
            shortUrl,
          });

          listEl.appendChild(el);

          return parser;
        });

        if (expandable) {
          dom.get("button[data-action=delete]", baseEl).onclick = () => {
            const newValue = mapFilter([...listEl.children], (el, i) => {
              if (dom.get<HTMLInputElement>("[data-selector]", el).checked) {
                el.remove();
                return null;
              }

              return getValue()[i];
            }) as T[];

            parsers = newValue.map((initial, i) => {
              const [_el, parsers] = newRow({
                initial,
                defaultValue: cfg.default[i],
                getValue: () => getValue()[i] as T,
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
            const idx = parsers.length;
            const [el, parser] = newRow({
              defaultValue: cfg.default[idx],
              getValue: () => getValue()[idx] as T,
              onChange: value => {
                onChange(getValue().with(idx, value));
              },
              shortUrl,
            });

            listEl.appendChild(el);

            parsers.push(parser);

            onChange(getItemValues(baseEl, parsers, expandable));
          };
        }

        return baseEl;
      },
    };
  });
};
