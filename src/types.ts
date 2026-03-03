import type { Base64 } from "niall-utils";

export interface ContentParser {
  type: "Content";
  html: (id: string | null) => HTMLElement;
}

export interface ValueParser<T> {
  type: "Value";
  html: (
    id: string | null,
    query: string | null,
    shortUrl: boolean
  ) => HTMLElement;
  serialise: (shortUrl: boolean) => string | Base64 | null;
  updateValue: (el: HTMLElement, shortUrl: boolean) => void;
  getValue: (el: HTMLElement) => T;
}

export type Parser<T> = ContentParser | ValueParser<T>;

export type ParserValue<P extends Parser<unknown>> =
  P extends ValueParser<infer T> ? T : P extends ContentParser ? null : never;

export type InitParser<P extends Parser<unknown>> = {
  label?: string;
  title?: string;
  methods: (
    onChange: (value: ParserValue<P>) => void,
    getValue: () => ParserValue<P>,
    externalCfg?: { initial: ParserValue<P> | null; default: ParserValue<P> }
  ) => P;
};

export type InitParserObject<
  O extends Record<string, unknown> = Record<string, unknown>,
> = {
  [K in keyof O]: InitParser<Parser<O[K]>>;
};
