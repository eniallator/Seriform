import type { AnyParserRecord, AnyParserValue } from "../../types.ts";

export interface Condition<Cfg extends AnyParserRecord> {
  id: keyof Cfg;
  test: (value: Cfg[keyof Cfg]) => boolean;
  negate: () => Condition<Cfg>;
}

export const satisfies = <const Id extends string, T extends AnyParserValue>(
  id: Id,
  test: (value: T) => boolean
): Condition<Record<Id, T>> => ({
  id,
  test,
  negate: () => satisfies(id, value => !test(value)),
});

export const equals = <const Id extends string, const T extends AnyParserValue>(
  id: Id,
  value: T
): Condition<Record<Id, T>> => satisfies(id, current => current === value);
