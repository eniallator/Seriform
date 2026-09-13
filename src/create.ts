import type {
  AnyParserRecord,
  AnyParserValue,
  InitParser,
  InitParserObject,
  Parser,
  ResolvedParserObject,
  SiblingContext,
} from "./types.ts";

export const createParsers = <O extends AnyParserRecord>(
  parsers: InitParserObject<O, NoInfer<Partial<O>>>
): ResolvedParserObject<O> => parsers;

export const valueParser = <
  T extends AnyParserValue,
  Cfg extends AnyParserRecord = AnyParserRecord,
>(
  init: (
    onChange: (value: T) => void,
    getValue: () => T,
    externalCfg?: { initial: T | null; default: T },
    siblings?: SiblingContext<Cfg>
  ) => Required<Parser<T>>,
  label?: string,
  title?: string
): InitParser<Required<Parser<T>>, Cfg> => ({
  label,
  title,
  methods: init as InitParser<Required<Parser<T>>>["methods"],
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
