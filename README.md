# Parform

Yes you read that right, this library focuses on parsing forms - hence parform.\
This package lets you define data driven forms, with full typescript support.\
The motivation behind this was to create a light-weight, non-framework dependant form parsing library. I use this to create projects where I need to be able to share filled in forms, to create share links.

## Quick Example

```typescript
import { Parform, createParsers, numberParser, rangeParser } from "parform";

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
const parform = new Parform(config, baseEl, {
  query: location.search,
  shortUrl: true,
});
parform.addCopyToClipboardHandler("#share-button");
parform.addListener(values => {
  console.log("Config changed:", values);
});
```

## API Summary

- **`Parform`**: Manages state, DOM, listeners, and URL sync.
- **`createParsers<O>`**: Group parsers into a typed configuration object.
- **`valueParser<T>`**: Create a value parser (text, number, range, etc.).
- **`contentParser`**: Create non-editable content parsers (buttons, etc.).

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

### Available Content parsers

- **`buttonParser`**: Button elements that trigger actions without modifying state.

### Collection parser

- **`collectionParser`**: Manage arrays/tuples as dynamic rows. It renders a table where each row contains the configured field parsers and supports:
  - **Dynamic rows:** Add and remove rows at runtime (when `expandable: true`, the UI shows `Add Row` and `Delete Selected` controls).
  - **Multi-field rows:** Each row can combine different parser types (numbers, selects, colors, etc.).
  - **Serialization:** Encodes the collection as a CSV-like query segment with escaping for commas and backslashes.
  - **State sync:** Row values are kept in sync with internal state; adding/removing rows updates listeners.

  Use `fields` to declare the parsers for each column and `default` to provide an initial set of rows.

## Type safety

- **createParsers** The `createParsers` factory returns an object whose shape is reflected in the TypeScript types used by `Parform` and listeners. Use `InitParserObject` and `ParserValue` types to extract and reuse inferred shapes in your codebase.
- **Polymorphic State Interaction** `Parform.getValue(id)` lets you retrieve the value of a given input, typed to that input's value.

Example:

```typescript
const config = createParsers({
  foo: checkboxParser({ default: true }),
  bar: textParser({ default: "Hello World!" }),
});

const baseEl = document.getElementById("shareable-form");
const parform = new Parform(config, baseEl, { query: location.search });

parform.getValue("foo"); // Is type boolean
parform.getValue("bar"); // Is type string
```

## Pluggable parsers

- **Overview:** The library ships a set of built-in value and content parsers, but it is intentionally pluggable — you can define and register your own parsers by returning an `InitParser<...>` object. Custom parsers integrate with the same lifecycle: initialization, DOM rendering, value extraction, update, and serialization.

- **Anatomy — `ValueParser<T>`:**
  - `type: "Value"` — discriminant.
  - `html(id, query, shortUrl): HTMLElement` — render the input DOM for this parser.
  - `serialise(shortUrl): string | null` — return a compact query representation or `null` when equal to default.
  - `updateValue(el, shortUrl): void` — (re)render/update DOM when the state changes.
  - `getValue(el): T` — read the value from the DOM element.

- **Anatomy — `ContentParser`:**
  - `type: "Content"` — discriminant.
  - `html(id): HTMLElement` — render read-only content (buttons, info panels, etc.).

There are some helpers for these: `valueParser<T>(...)` and `contentParser(...)`.

Example — simple custom value parser (text input with uppercase normalization):

```typescript
const uppercaseTextParser = valueParser<string>(
  (onChange, getValue, initial) => ({
    html: (id, query) => {
      const input = document.createElement("input");
      if (id != null) {
        input.id = id;
      }

      input.value =
        query != null
          ? decodeURIComponent(query)
          : (initial?.initial ?? initial?.default ?? "");
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
yarn typecheck
yarn test
```

## Common use cases

- **Shareable visual configs:** Create editors whose state is encoded in the URL.
- **Data tables:** Use `collectionParser` for multi-field row management.
- **Persisted preferences:** Serialize state to URL.

## API reference

-- **`Parform.addListener(callback, subscriptions?)`**: Register change listeners.
-- **`Parform.addCopyToClipboardHandler(selector, extra?)`**: Add a share button.
-- **`Parform.serialiseToUrlParams(extra?)`**: Return current config as a URL query string segment.

For implementation details and source, see the package `src/` files and parser implementations under `src/parsers/`.
