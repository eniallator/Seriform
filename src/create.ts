import type {
  AnyDependencies,
  Dependency,
  DependencyValues,
  Derived,
  Path,
} from "./dependencies.ts";
import type {
  AnyParserValue,
  FieldsValue,
  InitParser,
  InitParserObject,
  MethodsContext,
  Parser,
  ResolvedParserObject,
  ScopedFields,
} from "./types.ts";

export const createParsers = <
  const Fields extends InitParserObject<FieldsValue<Fields>>,
>(
  parsers: ScopedFields<FieldsValue<Fields>, Fields, true, Fields>
): ResolvedParserObject<FieldsValue<Fields>> =>
  parsers as ResolvedParserObject<FieldsValue<Fields>>;

export const valueParser = <
  T extends AnyParserValue,
  const Deps extends AnyDependencies | undefined = undefined,
>(
  methods: (ctx: MethodsContext<T>) => Required<Parser<T>>,
  label?: string,
  title?: string,
  deps?: Deps
): InitParser<Required<Parser<T>>, Deps> => ({ label, title, methods, deps });

export const dependency =
  <T>() =>
  <const P extends Path>(...path: P): Dependency<T, P> =>
    ({ path }) as Dependency<T, P>;

export const derived = <T, const Deps extends AnyDependencies>(
  derive: (...values: DependencyValues<Deps>) => T,
  deps: Deps
): Derived<T, Deps> => ({ deps, derive });

export const contentParser = (
  initHtml: (id: string | null, onChange: () => void) => HTMLElement,
  label?: string,
  title?: string
): InitParser<Parser> => ({
  label,
  title,
  methods: ({ onChange }) => ({
    getValue: () => null as never,
    html: id =>
      initHtml(id, () => {
        onChange(null as never);
      }),
  }),
});
