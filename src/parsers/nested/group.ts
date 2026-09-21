import { mapFilter } from "niall-utils";
import { tuple } from "niall-utils/core";
import { typedFromEntries, typedKeys, typedToEntries } from "niall-utils/data";
import { dom } from "niall-utils/ui";

import {
  resolveDependency,
  type AnyDependencies,
  type ValidateScope,
} from "../../dependency.ts";
import {
  decodeArray,
  decodeRecord,
  encodeArray,
  encodeRecord,
} from "../../encoding.ts";
import { FieldRegistry } from "../../fieldRegistry.ts";
import { configItem, hashKey } from "../../helpers.ts";
import {
  valueParser,
  type BaseConfig,
  type FieldsValue,
  type InitParser,
  type InitParserObject,
  type Parser,
  type ScopedFields,
} from "../../parser.ts";
import type { AnyParserValue } from "../../types.ts";

const childElement = (wrapperEl: Element, i: number): HTMLElement =>
  wrapperEl.children[i]?.lastElementChild as HTMLElement;

export interface GroupConfig<
  Fields extends InitParserObject = InitParserObject,
> extends BaseConfig {
  children: Fields;
  hashLength?: number;
}

/** The exact `pending` type `ValidateScope` already computed for this group - reused (not
 * re-derived) so the deps this group exposes to whatever contains it stay literal-precise. */
type GroupPending<Fields extends InitParserObject<FieldsValue<Fields>>> =
  ValidateScope<FieldsValue<Fields>, Fields, false> extends {
    pending: infer P extends AnyDependencies;
  }
    ? P
    : readonly [];

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

export const groupParser = <
  const Fields extends InitParserObject<FieldsValue<Fields>>,
>(
  cfg: ScopedFields<FieldsValue<Fields>, Fields, false, GroupConfig<Fields>>
) => {
  const { children, label, title, attrs, hashLength } =
    cfg as GroupConfig<Fields>;

  // `Fields`'s own per-key value type is a conditional (`FieldsValue<Fields>[K]`) that TS won't
  // distribute over a runtime-bound key, so the body below works against this one loosened view
  // of `children` instead of `Fields` directly - cast once here, not per access - and only the
  // handful of true boundaries (the composite value handed back out, and the deps handed to
  // whatever contains this group) cast back to the precise, literal types.
  type Value = FieldsValue<Fields>;
  const looseChildren = children as unknown as Record<
    string,
    InitParser<Parser<AnyParserValue>>
  >;

  const childKeys = typedKeys(looseChildren);
  const recordKey = (key: string, shortUrl: boolean): string =>
    shortUrl ? hashKey(key, hashLength ?? 2) : key;

  const pending = typedToEntries(looseChildren).flatMap(([, initParser]) =>
    mapFilter(initParser.deps ?? [], dep => resolveDependency(dep, false))
  ) as unknown as GroupPending<Fields>;

  return valueParser<Value, GroupPending<Fields>>(
    ({ onChange, getValue, externalCfg, siblings }) => {
      let childParsers: Record<string, Parser<AnyParserValue>> = {};
      const looseGetValue = getValue as unknown as () => Record<
        string,
        AnyParserValue
      >;

      return {
        getValue: wrapperEl =>
          typedFromEntries<Record<string, AnyParserValue>>(
            childKeys.map((key, i) =>
              tuple(
                key,
                childParsers[key]?.getValue(childElement(wrapperEl, i))
              )
            )
          ) as unknown as Value,
        updateValue: (wrapperEl, shortUrl) => {
          childKeys.forEach((key, i) => {
            childParsers[key]?.updateValue?.(
              childElement(wrapperEl, i),
              shortUrl
            );
          });
        },
        serialise: shortUrl => {
          const entries = mapFilter(childKeys, childKey => {
            const key = recordKey(childKey, shortUrl);
            const value = childParsers[childKey]?.serialise?.(shortUrl);
            return value != null ? tuple(key, value) : null;
          });

          return entries.length === 0
            ? null
            : shortUrl
              ? encodeShortRecord(entries)
              : encodeRecord(Object.fromEntries(entries));
        },
        html: (id, query, shortUrl) => {
          const registry = new FieldRegistry(siblings);
          const looseExternalCfg = externalCfg as unknown as
            | {
                initial: Record<string, AnyParserValue> | null;
                default: Record<string, AnyParserValue>;
              }
            | undefined;

          const built = typedToEntries(looseChildren).map(
            ([key, initParser], i) => {
              const childId = id != null ? `${id}-${key}` : key;
              const childParser = initParser.methods({
                id: childId,
                onChange: value => {
                  onChange({ ...getValue(), [key]: value });
                  registry.notify(key, value);
                },
                getValue: () => looseGetValue()[key],
                externalCfg:
                  looseExternalCfg != null
                    ? {
                        initial: looseExternalCfg.initial?.[key] ?? null,
                        default: looseExternalCfg.default[key],
                      }
                    : undefined,
                siblings: registry.context(),
              });
              // Read straight from this child's own rendered DOM (like the final notify sweep
              // below), not the outer `getValue()` context - a sibling discovering this field's
              // value via `siblings.get()` shouldn't depend on the parent's own state-caching
              // being correct; `wrapperEl` isn't assigned yet at this point in `html()`, but this
              // getter is only ever invoked later, once it is (a lazy closure, same as `register`
              // everywhere else in the codebase).
              registry.register(key, () =>
                childParsers[key]?.getValue(childElement(wrapperEl, i))
              );
              return tuple(key, childParser, initParser, childId);
            }
          );

          childParsers = typedFromEntries(
            built.map(([key, childParser]) => tuple(key, childParser))
          );

          const record =
            query == null
              ? {}
              : shortUrl
                ? decodeShortRecord(query, hashLength ?? 2)
                : decodeRecord(query);

          const wrapperAttrs = dom.toAttrs({
            ...(id != null && { id }),
            ...(title != null && { title }),
            ...attrs,
          });
          const wrapperEl = dom.toHtml(`<div ${wrapperAttrs}></div>`);

          built.forEach(([key, childParser, initParser, childId]) => {
            const childQuery =
              childParser.serialise != null
                ? (record[recordKey(key, shortUrl)] ?? null)
                : null;
            const el = childParser.html(childId, childQuery, shortUrl);
            wrapperEl.appendChild(
              configItem(childId, el, initParser.label, initParser.title)
            );
          });

          // Read fresh values straight from each child's own rendered DOM (mirroring
          // `getValue: wrapperEl => ...` above), not the outer `getValue()` context - this runs
          // synchronously during construction, before this group's own value has necessarily
          // been captured by whatever contains it (mirrors `SeriForm`'s constructor, which also
          // calls `parser.getValue(el)` only after `html()` returns, never during it).
          built.forEach(([key, childParser], i) => {
            registry.notify(
              key,
              childParser?.getValue(childElement(wrapperEl, i))
            );
          });

          return wrapperEl;
        },
      };
    },
    label,
    title,
    pending
  );
};
