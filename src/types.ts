import type { Base64 } from "niall-utils/encoding";

export interface Parser<T extends NonNullable<unknown> = never> {
  html: (
    id: string | null,
    query: string | null,
    shortUrl: boolean
  ) => HTMLElement;
  getValue: (el: HTMLElement) => T;
  serialise?: (shortUrl: boolean) => string | Base64 | null;
  updateValue?: (el: HTMLElement, shortUrl: boolean) => void;
}

export type ParserValue<P extends Parser<NonNullable<unknown>>> =
  P extends Parser<infer T> ? T : never;

export interface InitParser<P extends Parser<NonNullable<unknown>>> {
  label?: string;
  title?: string;
  methods: (
    onChange: (value: ParserValue<P>) => void,
    getValue: () => ParserValue<P>,
    externalCfg?: { initial: ParserValue<P> | null; default: ParserValue<P> }
  ) => P;
}

export type InitParserObject<
  O extends Record<string, NonNullable<unknown>> = Record<
    string,
    NonNullable<unknown>
  >,
> = { [K in keyof O]: InitParser<Parser<O[K]>> };
