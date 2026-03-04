import {
  dom,
  mapFilter,
  mapObject,
  Option,
  tuple,
  typedToEntries,
} from "niall-utils";

import { configItem, parseQuery, queryKey } from "./helpers.ts";

import type { Base64, DiscriminatedOptions, Entry } from "niall-utils";
import type { InitParserObject, Parser, ValueParser } from "./types.ts";

interface StateItem<T> {
  parser: Parser<T>;
  value: T;
  el: HTMLElement;
}

type State<R extends Record<string, unknown>> = {
  [K in keyof R]: StateItem<R[K]>;
};

type SeriFormDiscriminatedOptions = DiscriminatedOptions<
  { query: string },
  { shortUrl?: false } | { shortUrl: true; hashLength?: number }
>;

export type SeriFormOptions = SeriFormDiscriminatedOptions["external"];

export class SeriForm<const R extends Record<string, unknown>> {
  private readonly hashLength: number | null;
  private readonly state: State<R>;
  private readonly listeners: {
    callback: (values: R, updatedId?: keyof R) => void;
    subscriptions: Set<keyof R>;
  }[] = [];

  constructor(
    initParsers: InitParserObject<R>,
    baseEl: HTMLElement,
    options: SeriFormDiscriminatedOptions["internal"]
  ) {
    const { query, shortUrl, hashLength } = options;
    this.hashLength = shortUrl ? (hashLength ?? 6) : null;

    const initialValues = parseQuery(query, this.hashLength);

    this.state = mapObject(initParsers, ([id, initParser]): Entry<State<R>> => {
      const { label, title, methods } = initParser;
      const parser = methods(
        value => {
          if (value != null) this.state[id].value = value;
          this.tellListeners(id);
        },
        () => this.state[id].value
      );

      const key = queryKey(id as string, this.hashLength);
      const query = initialValues[key] ?? null;
      const el = parser.html(id as string, query, shortUrl ?? false);
      baseEl.appendChild(configItem(id as string, el, label, title));
      const value =
        parser.type === "Value" ? parser.getValue(el) : (null as R[typeof id]);

      return tuple(id, { parser, el, value });
    });
  }

  getAllValues(): R {
    return mapObject(this.state, ([id, { value }]) =>
      tuple(id, structuredClone(value))
    );
  }

  getValue<I extends keyof R>(id: I): R[I] {
    return structuredClone(this.state[id].value);
  }

  setValue<I extends keyof R>(id: I, value: R[I]): void {
    const { parser, el } = this.state[id];
    if (parser.type === "Value") {
      this.state[id].value = value;
      parser.updateValue(el, this.hashLength != null);
    }
  }

  addListener(
    callback: (values: R, updatedId?: keyof R) => void,
    subscriptions: (keyof R)[] = []
  ): void {
    this.listeners.push({ callback, subscriptions: new Set(subscriptions) });
  }

  tellListeners(id?: keyof R): void {
    this.listeners.forEach(({ subscriptions, callback }) => {
      if (id == null || subscriptions.size === 0 || subscriptions.has(id)) {
        callback(this.getAllValues(), id);
      }
    });
  }

  serialiseToUrlParams(): string {
    const urlPart = (key: string, value: string | Base64): string =>
      [queryKey(key, this.hashLength), encodeURIComponent(value)].join(
        this.hashLength != null ? "" : "="
      );

    return mapFilter(typedToEntries(this.state), ([id, { parser }]) =>
      Option.some(parser)
        .guard((p): p is ValueParser<R[keyof R]> => p.type === "Value")
        .map(p => p.serialise(this.hashLength != null))
        .map(serialised => urlPart(id as string, serialised))
    ).join("&");
  }

  addCopyToClipboardHandler(selector: string) {
    dom.addListener(dom.get(selector), "click", () => {
      const query = this.serialiseToUrlParams();
      const { protocol, host, pathname } = location;
      const shareUrl = `${protocol}//${host}${pathname}${
        query.length > 0 ? "?" + query : ""
      }`;
      void navigator.clipboard.writeText(shareUrl);
    });
  }
}
