# Seriform

This package focuses on serialising forms, hence the name Seriform. It lets you define data driven forms, with full typescript support.\
The motivation behind this was to create a light-weight, non-framework dependant form to URL parsing library. I use this to create projects where I need to be able to share filled in forms, to create share links.

This library uses Parsers as it's building blocks, which are entirely self-contained building blocks which define things like serialisation/deserialisation/HTML Elements/interactivity.\
The library has some standard parsers available, however since they are self-contained, it is easy to make custom parsers.

**[Live demo](https://eniallator.github.io/Seriform/)** — every parser type wired up in one config.

## Quick Example

```typescript
import { createParsers, numberParser, rangeParser, SeriForm } from "seriform";

const config = createParsers({
  speed: numberParser({
    label: "Animation Speed",
    default: 1,
    attrs: { min: "0.1", max: "5", step: "0.1" },
  }),
  size: rangeParser({
    label: "Size",
    default: 50,
    attrs: { min: "10", max: "100", step: "1" },
  }),
});

const baseEl = document.getElementById("config-ui") as HTMLElement;
const seriform = new SeriForm(config, baseEl, {
  query: location.search,
  shortUrl: true,
});
seriform.addCopyToClipboardHandler("#share-button");
seriform.addListener(values => {
  console.log("Config changed:", values);
});
```

## API Summary

- **`SeriForm`**: Manages state, DOM, listeners, and URL sync.
- **`createParsers<O>`**: Group parsers into a typed configuration object.
- **`valueParser<T>`**: Create a value parser (text, number, range, etc.).
- **`contentParser`**: Create non-editable content parsers (buttons, etc.).
- **Collection Parsers** (`tableParser`, `listParser`): Are just value parsers, however they work on arrays of values, not just a single value.
  - **Dynamic rows:** Add and remove rows at runtime (when `expandable: true`, the UI shows `Add Row` and `Delete Selected` controls).
  - **Serialization:** Encodes the collections as CSV-like queries with escaping for commas and backslashes.
  - **State sync:** Items are kept in sync with internal state; adding/removing rows updates listeners.
- **`groupParser`**: Nests a set of child parsers under a single id, serialising them together as one object value. See [Available Collection Parsers](#available-collection-parsers).
- **Conditional Parsers** (`when`, `unless`, `ifParser`): Show/hide or switch between parsers based on a sibling field's value. See [Conditional Parsers](#conditional-parsers).

### Available Value Parsers

- **`textParser`**: Single-line text (use `area: true` for textarea).
- **`numberParser`**: Numeric input with `min`/`max`/`step`.
- **`checkboxParser`**: Boolean toggle.
- **`colorParser`**: Color picker (hex strings).
- **`datetimeParser`**: Date/time input.
- **`fileParser`**: File upload input.
- **`rangeParser`**: Slider input.
- **`selectParser`**: Dropdown with `options`.

All parsers accept common options: `label`, `title`, `default`, and `attrs` for HTML attributes.

### Available Content Parsers

- **`buttonParser`**: Button elements that trigger actions without modifying state.

### Available Collection Parsers

- **`tableParser`**: Uses a `table` element, where it has a `fields` attribute which is a tuple of parsers, one for each column of the table.
- **`listParser`**: Uses a `ul` element, where it has a `field` attribute which is the parser to use for each list item.
- **`groupParser`**: Nests a set of `children` parsers (built with `createParsers`-style config) under a single id, serialising them together as one value.

### Conditional Parsers

Conditional parsers show/hide (or switch between) other parsers based on the current value of one or more sibling fields, referenced by path. They subscribe to sibling changes and only serialise/contribute a value while active.

A path is a tuple of keys locating a field relative to where the conditional parser itself sits: `["plan"]` is a direct sibling, `["..", "profile", "plan"]` walks up one enclosing `groupParser` scope and back down into `profile`, and `["~", "plan"]` is always resolved from the true root regardless of nesting depth. Every path is validated at compile time against the actual config shape it's placed into — a typo'd key or a walk past the root is a type error, not a runtime surprise.

- **`when`**: Renders `parser` only while `condition` is satisfied; otherwise its value is `undefined` and it serialises to nothing.
- **`unless`**: The inverse of `when` — renders `parser` only while `condition` is _not_ satisfied.
- **`ifParser`**: Given an ordered list of `branches` (each an `{ condition, parser }` pair), renders the first branch whose condition matches, falling back to `otherwise`.

`when`/`unless`/`ifParser` all take their `condition` as a `Derived<boolean, Deps>` — a boolean computed from one or more dependencies together. A few ways to build one:

- **`equals(path, value)`**: True when the field at `path` currently equals `value`.
- **`satisfies(path, test)`**: True when `test(value)` returns true for the field at `path`.
- **`derived(fn, deps)`**: True when `fn` returns true, given every dependency's resolved value — for a condition spanning more than one field, built from paths via `dependency<T>()(...path)`.

`unless` is just `when` with its `condition` run through **`negate(condition)`**, which inverts a `Derived<boolean, Deps>` without touching its dependencies.

```typescript
const config = createParsers({
  "show-details": checkboxParser({ label: "Show details", default: false }),
  details: when({
    condition: equals(["show-details"], true),
    parser: textParser({ label: "Details", default: "" }),
    label: "Details",
  }),
});
```

`when`/`unless`/`ifParser` branches can each depend on more than one field at once via `derived`:

```typescript
const config = createParsers({
  plan: selectParser({ default: "free", options: ["free", "pro", "team"] }),
  seats: numberParser({ default: 1 }),
  access: ifParser({
    branches: [
      {
        condition: derived(
          (plan, seats) => plan === "team" && seats > 5,
          [dependency<string>()("plan"), dependency<number>()("seats")]
        ),
        parser: textParser({ label: "Enterprise access", default: "" }),
      },
    ],
    otherwise: textParser({ label: "Standard access", default: "" }),
  }),
});
```

## Type safety

- **createParsers** The `createParsers` factory returns an object whose shape is reflected in the TypeScript types used by `SeriForm` and listeners. Use `InitParserObject` and `ParserValue` types to extract and reuse inferred shapes in your codebase.
- **Polymorphic State Interaction** `SeriForm.getValue(id)` lets you retrieve the value of a given input, typed to that input's value.

Example:

```typescript
const config = createParsers({
  foo: checkboxParser({ default: true }),
  bar: textParser({ default: "Hello World!" }),
});

const baseEl = document.getElementById("shareable-form");
const seriform = new SeriForm(config, baseEl, {
  query: location.search,
});

seriform.getValue("foo"); // Is type boolean
seriform.getValue("bar"); // Is type string
```

## Pluggable parsers

- **Overview:** The library ships a set of built-in value and content parsers, but it is intentionally pluggable — you can define and register your own parsers by returning an `InitParser<...>` object. Custom parsers integrate with the same lifecycle: initialization, DOM rendering, value extraction, update, and serialization.

- **Anatomy — `Parser<T>`:** every parser is the same shape; whether it contributes a real value is determined by which optional methods it defines, not a discriminant tag.
  - `html(id, query, shortUrl): HTMLElement` — render the DOM for this parser.
  - `getValue(el): T` — read the value from the DOM element.
  - `serialise(shortUrl): string | null` — _(optional)_ return a compact query representation or `null` when equal to default. Omit this for read-only content (buttons, info panels, etc.).
  - `updateValue(el, shortUrl): void` — _(optional)_ (re)render/update DOM when the state changes. Omit alongside `serialise` for content-only parsers.

There are some helpers for these: `valueParser<T>(...)` for parsers with a real, non-nullable value (`T extends NonNullable<unknown>`), and `contentParser(...)` for read-only content, whose value type is always `never`.

`valueParser`'s init function receives a single context object: `{ id, onChange, getValue, externalCfg, siblings }`.\
`siblings` (present when this parser lives inside a `createParsers` config) exposes `get(path)`/`getAbsolute(path)`/`subscribe(path, cb)`/`subscribeAbsolute(path, cb)` for reading or reacting to other fields by path — this is what powers the [conditional parsers](#conditional-parsers). `getAbsolute`/`subscribeAbsolute` resolve from the true root regardless of nesting; a plain `path`/`subscribe` call resolves relative to this field's own immediate scope, walking up one level per leading `".."` segment.

Example — simple custom value parser (text input with uppercase normalization):

```typescript
const uppercaseTextParser = valueParser<string>(
  ({ onChange, getValue, externalCfg }) => ({
    html: (id, query) => {
      const input = document.createElement("input");
      if (id != null) {
        input.id = id;
      }

      input.value =
        query != null
          ? decodeURIComponent(query)
          : (externalCfg?.initial ?? externalCfg?.default ?? "");
      input.addEventListener("input", () => {
        onChange((input.value || "").toUpperCase());
      });
      return input;
    },
    serialise: () => encodeURIComponent(getValue()),
    updateValue: el => {
      (el as HTMLInputElement).value = getValue();
    },
    getValue: el => (el as HTMLInputElement).value,
  }),
  "Upper Text"
);
```

Example — simple content parser (info button):

```typescript
const infoButton = contentParser((id, onChange) => {
  const btn = document.createElement("button");
  if (id != null) {
    btn.id = id;
  }

  btn.textContent = "Copy config";
  btn.onclick = () => {
    console.log("custom action");
    onChange();
  };
  return btn;
}, "Info");
```

## Implementation notes

- **Serialization:** URL query parsing and encoding, with optional short/hash URLs.
- **State:** Two-way binding between DOM and internal state; selective serialization of changed values.
- **DOM:** Generates semantic form elements and integrates with `niall-utils` utilities.

## Tests

- Parser unit tests and config/state tests live alongside source files as `.test.ts` files. Run:

```bash
pnpm typecheck
pnpm test
```

## Common use cases

- **Shareable visual configs:** Create editors whose state is encoded in the URL.
- **Data tables:** Use `tableParser` for multi-field row management.
- **Persisted preferences:** Serialize state to URL.

## API reference

- **`SeriForm.getValue(id)`**: gets a specific parser's value.
- **`SeriForm.getAllValues()`**: gets a record of type `Record<id, value>` of all the parsers.
- **`SeriForm.setValue(id, value)`**: sets a specific parser's value.
- **`SeriForm.addListener(callback, subscriptions?)`**: Register change listeners.
- **`SeriForm.tellListeners(id?)`**: calls each listener, optionally filtering based on an id parameter in their subscriptions.
- **`SeriForm.serialiseToUrlParams()`**: Return current config as a URL query string segment.
- **`SeriForm.addCopyToClipboardHandler(selector)`**: Add a share button.

For implementation details and source, see the package `src/` files and parser implementations under `src/parsers/`.
