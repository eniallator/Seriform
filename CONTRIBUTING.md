# Contributing to Seriform

Thank you for your interest in contributing to Seriform! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Please review and adhere to our [Code of Conduct](CODE_OF_CONDUCT.md) in all interactions with the community.

## Getting Started

### Prerequisites

- Node.js 25.4.0 or higher
- Yarn 4.12.0 or higher
- Basic familiarity with TypeScript and runtime type checking concepts

### Setting Up Your Development Environment

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:

   ```bash
   git clone https://github.com/YOUR-USERNAME/Seriform.git
   cd Seriform
   ```

3. **Install dependencies**:

   ```bash
   yarn
   ```

## Development Workflow

### Building the Project

```bash
yarn build
```

This compiles the TypeScript source to JavaScript in the `dist/` directory.

### Running Tests

```bash
yarn test
```

Tests are written using Vitest. Please ensure all tests pass before submitting a pull request.

### Type Checking

```bash
yarn typecheck
```

Verify there are no TypeScript compilation errors (tests are allowed).

### Linting

```bash
yarn lint
```

The project uses ESLint with TypeScript support. Address all linting issues in your changes.

### Finding Issues

The previous two steps can be combined into one, by using the following command (runs typecheck and then lint)

```bash
yarn findissues
```

## Making Changes

### Code Organization

The project is organized into logical modules:

- **`src/parsers/content`** - Content parsers that come out-of-the-box
- **`src/parsers/value`** - Value parsers that come out-of-the-box
- **`src/parsers/collection`** - Collection parsers that come out-of-the-box
- **`src/serialisableForm.ts`** - The main SerialisableForm handling class
- **`src/create.ts`** - Typed creation helpers
- **`src/helpers.ts`** - Internal helper methods
- **`src/types.ts`** - Common types used for the library

### Writing Code

Follow these guidelines when contributing:

1. **Type Safety**: Leverage TypeScript's type system fully. All public functions must be properly typed.
2. **Type Tooltips**: Ensure type tooltips are descriptive and helpful. Test them in your IDE to verify clarity.
3. **Descriptive Names**: Use clear, self-documenting names for functions, variables, and types.
4. **Comments**: Use comments sparingly — code should be self-explanatory. Comments should explain _why_, not _what_.
5. **Consistency**: Match the existing code style and patterns in the codebase.

### Testing Requirements

- **Write tests** for any new functionality or bug fixes
- **Update existing tests** if you change behavior
- **Keep test coverage high** — aim for comprehensive coverage of guard functions
- Test files follow the pattern `*.test.ts` and use Vitest syntax

Example test structure:

```typescript
import { describe, expect, it, vi } from "vitest";

import { buttonParser } from "./button";

describe("buttonParser", () => {
  it("creates a button with correct text and attributes", () => {
    const parser = buttonParser({
      text: "Click me",
      attrs: { class: "my-btn", "data-hello": "world!" },
    });
    const el = parser.methods(vi.fn(), vi.fn()).html("btn-id");

    expect(el.tagName).toBe("BUTTON");
    expect(el.textContent).toBe("Click me");
    expect(el.getAttribute("class")).toBe("primary wrap-text my-btn");
    expect(el.getAttribute("id")).toBe("btn-id");
    expect(el.dataset.hello).toBe("world!");
  });

  it("calls onChange when clicked", () => {
    const parser = buttonParser({});
    const onChange = vi.fn();
    const el = parser.methods(onChange, vi.fn()).html("id");

    el.click();

    expect(onChange).toHaveBeenCalled();
  });

  it("should have defaults with an empty object", () => {
    const parser = buttonParser({});
    const el = parser.methods(vi.fn(), vi.fn()).html(null);

    expect(el.tagName).toBe("BUTTON");
    expect(el.textContent).toBe("");
    expect(el.getAttribute("class")).toBe("primary wrap-text");
    expect(el.hasAttribute("id")).toBe(false);
  });
});
```

## Submitting Changes

### Branching

Create a descriptive branch name:

```bash
git checkout -b feature/add-new-parser
# or
git checkout -b fix/issue-description
```

### Commit Messages

Write clear, concise commit messages:

- Use the imperative mood ("add" not "added")
- Keep the first line under 50 characters
- Provide more detail in the body if needed
- Reference issues when applicable (e.g., "Closes #123")

Example:

```text
Add button parser

This is a content parser, letting users click on a html
button and then triggering click events.

Closes #45
```

### Pull Requests

1. **Push your branch** to your fork
2. **Create a pull request** against the main repository
3. **Provide a clear description** that includes:
   - What changes you made and why
   - Any breaking changes
   - Tests added or updated
   - Related issues

4. **Ensure all checks pass**:
   - Tests pass (`yarn test`)
   - Type checking passes (`yarn typecheck`)
   - Linting passes (`yarn lint`)

Before submitting, run:

```bash
yarn prepublish
```

This runs the same checks that will run before publishing.

## Reporting Issues

When reporting bugs or suggesting features:

1. **Check existing issues** first to avoid duplicates
2. **Be specific** with reproduction steps for bugs
3. **Include your environment** (Node version, OS)
4. **Provide examples** when possible
5. **Be respectful** and constructive in your language

## Documentation

When contributing features:

- Update [README.md](README.md) if adding new public APIs or major features
- Consider the clarity of type definitions for end users

## Questions?

- Open a GitHub discussion for questions about the library
- Check existing issues and discussions first
- Be patient and respectful when seeking help

## Recognition

Contributors will be recognized in release notes and git history. We appreciate all contributions, from code to documentation to bug reports!

Thank you for helping make Seriform better! 🎉
