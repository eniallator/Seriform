import { generator } from "niall-utils/data";
import {
  base64FromUint,
  base64ToUint,
  unsafeBase64,
} from "niall-utils/encoding";
import { Option } from "niall-utils/functional";

/**
 * Length-prefixed framing for nesting an arbitrary number of already-serialised
 * child blobs inside a single query value. Frames need no escaping and are
 * self-terminating, so they support children of varying shape/length, and nest
 * freely (a frame's own content may itself be a further-encoded frame sequence).
 * Lengths are base64-encoded to keep the prefix compact. The "." delimiter is
 * one of the few characters `encodeURIComponent` leaves untouched, and isn't
 * part of the base64 alphabet, so it can't collide with the prefix itself.
 */
export const encodeFrames = (frames: (string | null | undefined)[]): string =>
  frames
    .map(frame => Option.from(frame).getOrElse(() => ""))
    .map(content => {
      const prefix =
        content.length === 0 ? "" : base64FromUint(content.length - 1) || "A";
      return `${prefix}.${content}`;
    })
    .join("");

export const decodeFrames = (data: string): (string | null)[] => {
  let i = 0;

  const frames = [
    ...generator(() => {
      if (i >= data.length) return null;

      const delimiterIdx = data.indexOf(".", i);
      const prefix = data.slice(i, delimiterIdx);
      const len =
        prefix.length === 0 ? 0 : base64ToUint(unsafeBase64(prefix)) + 1;
      const start = delimiterIdx + 1;
      const frame = data.slice(start, start + len);
      i = start + len;

      return frame;
    }),
  ];

  return frames.map(frame => (frame.length > 0 ? frame : null));
};
