import type { InitParser, InitParserObject, Parser } from "./types.ts";

export const createParsers = <O extends Record<string, NonNullable<unknown>>>(
  parsers: InitParserObject<O>
) => parsers;

export const valueParser = <T extends NonNullable<unknown>>(
  init: (
    onChange: (value: T) => void,
    getValue: () => T,
    externalCfg?: { initial: T | null; default: T }
  ) => Required<Parser<T>>,
  label?: string,
  title?: string
): InitParser<Required<Parser<T>>> => ({
  label,
  title,
  methods: init,
});

export const contentParser = (
  initHtml: (id: string | null, onChange: () => void) => HTMLElement,
  label?: string,
  title?: string
): InitParser<Parser> => ({
  label,
  title,
  methods: onChange => ({
    getValue: () => null as never,
    html: id =>
      initHtml(id, () => {
        onChange(null as never);
      }),
  }),
});
