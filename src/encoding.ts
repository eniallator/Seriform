import { generator } from "niall-utils/data";
import {
  base64FromUint,
  base64ToUint,
  unsafeBase64,
} from "niall-utils/encoding";
import { slidingWindow } from "niall-utils/math";

export const encodeArray = (arrays: (string | null | undefined)[]): string =>
  arrays
    .map(
      item =>
        `${
          item == null || item.length === 0
            ? ""
            : base64FromUint(item.length - 1)
        }.${item ?? ""}`
    )
    .join("");

export const decodeArray = (data: string): (string | null)[] => {
  let i = 0;

  const arrays = [
    ...generator(() => {
      if (i >= data.length) return null;

      const delimiterIdx = data.indexOf(".", i);
      const prefix = data.slice(i, delimiterIdx);
      const len =
        prefix.length === 0 ? 0 : base64ToUint(unsafeBase64(prefix)) + 1;
      const start = delimiterIdx + 1;
      const arr = data.slice(start, start + len);
      i = start + len;

      return arr;
    }),
  ];

  return arrays.map(arr => (arr.length > 0 ? arr : null));
};

export const encodeRecord = (
  record: Record<string, string | null | undefined>
): string =>
  encodeArray(Object.entries(record).flatMap(([key, value]) => [key, value]));

export const decodeRecord = (data: string): Record<string, string | null> =>
  Object.fromEntries(
    slidingWindow(decodeArray(data), 2, 0, 2).map(
      ([key, value]) => [key ?? "", value ?? null] as const
    )
  );
