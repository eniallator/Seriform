# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-09-21

### Added

- Paths as their own concept, with a derivable value mechanism (`src/derived.ts`);
  all conditions now use boolean derived values.
- A demo site under `demo/`, deployed automatically via a GitHub Actions workflow.

### Changed

- Reworked parsers to thread a context object through parsing, with various
  associated fixes and improvements.
- Reorganised the source tree to cut down on duplicate concepts (e.g. renamed
  `dependencies` to `dependency`, `create.ts` to `parser.ts`, removed the
  standalone `condition` parser, and moved `encoding` out of `parsers/nested`).
- Imports now go via the specific `niall-utils` submodules instead of the
  global import.
- Upgraded tooling and added more tests.
- Updated CONTRIBUTING and README docs.

### Fixed

- `undefined` no longer becomes the value of a parser.
- Fixed the `if` parser's types and the tests that depended on them.

## [1.3.1] - 2026-03-04

### Changed

- Renamed `SerialisableForm` to `Seriform`.

## [1.3.0] - 2026-03-04

### Changed

- Removed the extra parameter from serialisable forms.
- Tweaked the value parsers; the title no longer defaults to the label in a
  config item; renamed `collection` to `table` and restructured the
  collection/table parsers.

### Added

- Added a `listParser`.

## [1.2.0] - 2026-03-01

### Changed

- Made the collection/file values local to their methods functions.
- Reworded the README and added `extensions.json`.

## [1.1.0] - 2026-02-28

### Changed

- Renamed the package to Seriform, due to an npm name collision.
- Cleaned up the public API.

### Fixed

- Fixed README markdown and red underlines shown in the IDE.

## [1.0.0] - 2026-02-22

### Added

- Initial release, extracted from the `@web-art/config-parser` package
  previously part of the `web-animation-template` project.

[2.0.0]: https://github.com/eniallator/Seriform/compare/1.3.1...2.0.0
[1.3.1]: https://github.com/eniallator/Seriform/compare/1.3.0...1.3.1
[1.3.0]: https://github.com/eniallator/Seriform/compare/1.2.0...1.3.0
[1.2.0]: https://github.com/eniallator/Seriform/compare/1.1.0...1.2.0
[1.1.0]: https://github.com/eniallator/Seriform/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/eniallator/Seriform/releases/tag/1.0.0
