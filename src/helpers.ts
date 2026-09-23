import { tuple, type FillTuple } from "niall-utils/core";
import { generator } from "niall-utils/data";
import { base64FromUint, type Base64 } from "niall-utils/encoding";
import { dom } from "niall-utils/ui";

export const configItem = (
  id: string,
  el: HTMLElement,
  label?: string,
  title?: string
): HTMLDivElement => {
  const itemEl = dom.toHtml(`
    <div class="config-item"${title ? ` title="${title}"` : ""}>
      ${label ? `<label for="${id}" class="wrap-text">${label}</label>` : ""}
    </div>
  `);

  itemEl.appendChild(el);
  return itemEl;
};

// https://stackoverflow.com/a/7616484
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + (str.codePointAt(i) as number);
    hash &= hash; // Convert to 32bit integer
  }
  return hash;
};

export const hashKey = (
  key: string,
  hashLength: number | null
): string | Base64 =>
  hashLength == null
    ? encodeURIComponent(key)
    : base64FromUint(Math.abs(hashString(key)), hashLength);

export const parseQuery = (
  query: string,
  hashLength: number | null
): Record<string, string> => {
  const queryRegex =
    hashLength != null
      ? new RegExp(`[?&]?([^&]{${hashLength}})([^&]*)`, "g")
      : /[?&]?([^=&]+)=?([^&]*)/g;

  return Object.fromEntries(
    [...generator(() => queryRegex.exec(query))].map(tokens => {
      const [_, key, value] = tokens as unknown as FillTuple<string, 3>;
      return tuple(key, decodeURIComponent(value));
    })
  );
};
