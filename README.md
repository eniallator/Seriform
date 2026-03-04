# Seriform

This package focuses on serialising forms, hence the name Seriform. It lets you define data driven forms, with full typescript support.\
The motivation behind this was to create a light-weight, non-framework dependant form to URL parsing library. I use this to create projects where I need to be able to share filled in forms, to create share links.

This library uses Parsers as it's building blocks, which are entirely self-contained building blocks which define things like serialisation/deserialisation/HTML Elements/interactivity.\
The library has some standard parsers available, however since they are self-contained, it is easy to make custom parsers.

## Quick Example

```typescript
import { SeriForm, createParsers, numberParser, rangeParser } from "seriform";

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
- **Collection Parsers**: Are just value parsers, however they work on arrays of values, not just a single value.
  - **Dynamic rows:** Add and remove rows at runtime (when `expandable: true`, the UI shows `Add Row` and `Delete Selected` controls).
  - **Serialization:** Encodes the collections as CSV-like queries with escaping for commas and backslashes.
  - **State sync:** Items are kept in sync with internal state; adding/removing rows updates listeners.

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
