import type { Dependency, Path } from "../../dependencies.ts";
import type { AnyParserValue } from "../../types.ts";

export interface Condition<T, P extends Path = Path> extends Dependency<T, P> {
  test: (value: T) => boolean;
  negate: () => Condition<T, P>;
}

export const satisfies = <T extends AnyParserValue, const P extends Path>(
  path: P,
  test: (value: T) => boolean
): Condition<T, P> =>
  ({
    path,
    test,
    negate: () => satisfies(path, (value: T) => !test(value)),
  }) as Condition<T, P>;

export const equals = <T extends AnyParserValue, const P extends Path>(
  path: P,
  value: T
): Condition<T, P> => satisfies(path, current => current === value);
