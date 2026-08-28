# Reebbon — Engineering Instructions for Codex

## Mission

Reebbon is an offline-first React Native / Expo ebook reader for iOS and Android.

The MVP supports:

- EPUB
- PDF
- image folders (JPEG/PNG)
- CBZ
- CBR only if the dedicated technical spike validates a mobile-compatible RAR implementation

The application must provide a consistent reading experience while keeping format-specific rendering implementations isolated.

Read these documents before making architectural or product decisions:

- `docs/product/cahier-des-charges-liseuse-ebook.md`
- `docs/product/backlog-liseuse-ebook.md`
- `docs/product/sprint-planning-liseuse-ebook.md`
- `docs/design/design-system-liseuse.html`

Do not silently invent requirements when the specifications are ambiguous.

---

# Source priority

When requirements conflict, apply the following order:

1. current GitHub Issue / explicit task instructions
2. this `AGENTS.md`
3. product requirements document
4. backlog acceptance criteria
5. sprint planning
6. design system for visual and motion details

Report unresolved conflicts in the Pull Request.

Never expand product scope without an explicit Issue.

---

# Architecture

Use a layered architecture with dependency inversion.

Expected top-level source structure:

```text
src/
├── domain/
├── application/
├── infrastructure/
├── presentation/
└── shared/
```

Dependencies must point inward.

Allowed dependency direction:

```text
presentation
     ↓
application
     ↓
domain

infrastructure
     ↓
domain / application ports
```

The domain layer must never import:

- React
- React Native
- Expo
- SQLite
- filesystem APIs
- WebView
- react-native-pdf
- gesture libraries
- UI libraries

Infrastructure implements ports defined by the domain/application layers.

Presentation never accesses SQLite or the filesystem directly.

---

# Domain model

Use explicit domain types.

`BookFormat` must represent the format used by the reader:

```ts
type BookFormat = "epub" | "pdf" | "images";
```

CBZ and CBR are import formats that become image-set books. They are not separate reader formats.

Reader positions must use a discriminated union.

Never represent positions as an untyped `string | number`.

Example:

```ts
type ReaderPosition =
  | { kind: "epub"; cfi: string }
  | { kind: "pdf"; page: number }
  | { kind: "images"; index: number };
```

Repositories are ports.

At minimum provide:

- `BookRepository`
- `ReadingProgressRepository`
- `BookmarkRepository`

Infrastructure provides SQLite implementations.

---

# Reader architecture

There must be one common reader abstraction.

Format-specific readers:

- `EpubReader`
- `PdfReader`
- `ImageSetReader`

Reader-specific behavior must be exposed through capabilities rather than scattered format checks in presentation code.

Examples of capabilities:

- table of contents
- continuous scroll
- font customization
- zoom
- configurable reading direction
- double-page mode

Avoid repeated checks such as:

```ts
if (book.format === 'epub')
```

throughout the UI.

Keep format-specific decisions inside the reader adapters, registry, or capability model.

---

# Import architecture

All imports go through one application-level import pipeline.

Conceptual flow:

```text
ImportSource
→ validation
→ format detection
→ importer resolution
→ metadata extraction
→ filesystem staging
→ persistent resources
→ SQLite persistence
→ ImportResult
```

Importers must implement a common port.

Required implementations:

- EPUB importer
- PDF importer
- image-directory importer
- CBZ importer

CBZ must decompress and then reuse the image-directory pipeline.

Do not duplicate the image-book creation logic.

CBR must not be implemented before the technical spike validates:

- licensing
- App Store compatibility
- Play Store compatibility
- binary size impact
- mobile performance

If the spike fails, CBR must remain explicitly unsupported.

---

# Import robustness

Imports must not leave partial books behind.

Use a staging area.

If an import fails:

- remove temporary files
- rollback database changes
- return a typed domain/application error
- show a clear user-facing error
- never crash the application

Corrupted or unsupported files are expected input conditions and must be handled explicitly.

---

# Persistence

Use SQLite for structured application data.

At minimum:

- books
- reading progress
- bookmarks
- application preferences

Use migrations.

Never rely on destructive schema recreation in production.

Use the filesystem for imported ebook content and generated/extracted resources.

Do not store EPUB/PDF/image binaries in SQLite.

Book deletion must remove both database records and owned local files.

---

# Offline-first

Core reading and library behavior must work with networking completely unavailable.

No imported ebook content may be uploaded to third-party servers.

Do not introduce cloud dependencies into MVP application flows.

Fonts required by the UI and EPUB reading experience must be bundled with the application and must not depend on Google Fonts or another CDN at runtime.

---

# Design system

`docs/design/design-system-liseuse.html` is the visual source of truth.

Create reusable TypeScript design tokens.

Do not copy raw color, spacing, radius, font, or duration values into components.

Use semantic theme tokens.

Maintain the distinction between:

- Paper: light UI / reading theme
- Walnut: dark application chrome
- Sepia: sepia reading surface
- Night: dark reading surface

Never use standard Oxblood text on Walnut or Night where the design system requires Oxblood Tint for contrast.

Fonts:

- Fraunces: display / brand
- Public Sans: application UI
- Literata: EPUB reading
- IBM Plex Mono: folios / progress / metadata labels

The app must bundle these fonts for offline use.

Motion tokens:

- quick feedback: 120 ms
- UI transition: 260 ms
- reading/theme signature transition: 480 ms

Do not add decorative animation without an explicit requirement.

---

# Ribbon

There is one canonical `Ribbon` component.

Do not create independent implementations for:

- library
- reader
- import animation

The component may expose variants or composed wrappers, but geometry, styling and progression behavior must have a single implementation.

The ribbon is a signature element and should remain the only visually assertive decorative element.

---

# React / React Native rules

Use functional components and hooks.

Keep domain/application logic outside React components.

Components should primarily:

- render data
- handle UI interactions
- invoke application use cases

Do not place filesystem, database or parsing logic inside components or hooks tied to screens.

Prefer composition over large configurable components.

Do not introduce global state libraries unless application state requirements clearly justify them.

Local persistent data remains in repositories; do not duplicate SQLite data into a second permanent source of truth.

Avoid premature abstractions, but eliminate actual duplication.

---

# TypeScript

TypeScript strict mode is mandatory.

Do not use `any` unless interacting with an untyped third-party boundary and the value is immediately validated/narrowed.

Prefer:

- discriminated unions
- readonly properties
- explicit domain types
- exhaustive switches

All external/untrusted data must be validated before entering the domain.

Do not use non-null assertions to hide invalid states.

---

# Errors

Use typed errors/results at infrastructure boundaries.

Do not identify application errors by comparing arbitrary error message strings.

Distinguish at minimum:

- unsupported format
- corrupted source
- permission/access failure
- filesystem failure
- metadata extraction failure
- persistence failure

Convert low-level errors into application/domain errors before presentation.

---

# Testing

Every feature must include relevant automated tests.

Shared services explicitly require unit tests.

At minimum run before finishing a task:

```bash
npm run lint
npm run typecheck
npm test
```

If the repository provides a combined validation command, prefer:

```bash
npm run check
```

Never claim that a task is complete if required tests are failing.

If a failure is unrelated and pre-existing:

1. verify that it is pre-existing,
2. document it clearly in the PR,
3. do not silently modify unrelated code to fix it.

Add regression tests for bugs.

---

# Performance-sensitive areas

Treat the following areas as performance-critical:

## EPUB

Validate:

- large EPUBs
- malformed EPUBs
- navigation responsiveness
- resume position handling

Target standard-book opening time from the product specification: under one second where realistic on supported test devices.

## Image reader

Validate:

- 200+ page books
- high-resolution scans
- pinch zoom
- pan
- adjacent-page preload
- memory usage

Adjacent image preloading is required behavior, not optional polish.

Avoid mounting all full-resolution pages simultaneously.

## Library

Progress updates must not cause unnecessary rerendering of the complete book grid.

---

# Expo

This is a production Expo application.

Use development builds as the normal native development environment.

Do not assume Expo Go compatibility for production dependencies.

Install Expo ecosystem dependencies using the Expo-compatible installation command when appropriate.

Do not manually choose incompatible native dependency versions.

Native dependency additions must be mentioned in the PR.

---

# GitHub workflow

`main` is the integration branch.

Never push unfinished work directly to `main`.

Each product backlog item should normally correspond to:

```text
1 GitHub Issue
→ 1 Codex task
→ 1 Pull Request
→ 1 merge
```

Keep PRs narrowly scoped.

Do not implement stories from later sprints unless they are required dependencies of the current story and the reason is documented.

Do not opportunistically refactor unrelated modules.

---

# GitHub Issue

The Issue should contain:

- backlog ID
- user story
- acceptance criteria
- priority
- estimate
- dependencies
- relevant design references
- known technical risks

Before coding, verify that the requested work matches the Issue.

---

# Commits

Use Conventional Commits.

Examples:

```text
feat(import): add EPUB import pipeline
feat(reader): persist EPUB reading position
fix(images): preserve natural page order
refactor(reading): extract reader capability model
test(import): cover corrupted EPUB handling
chore(ci): add pull request checks
```

Include the backlog ID when useful:

```text
feat(import): support EPUB files [IMP-01]
```

Do not amend unrelated existing commits.

---

# Pull Requests

Every PR must contain:

## Summary

Explain the behavior added or changed.

## Backlog

Reference the relevant backlog ID and GitHub Issue.

## Implementation

Explain important architectural decisions.

## Verification

List exactly what was executed:

- lint
- typecheck
- unit tests
- integration tests
- manual device tests

Do not claim tests that were not run.

## Platforms

State validation status for:

- iOS
- Android

## UI

For UI changes, state validation status for applicable combinations:

- light application UI
- dark application UI
- Paper reading theme
- Sepia reading theme
- Night reading theme
- phone
- tablet when relevant

## Risks / follow-ups

Document known limitations or intentionally deferred work.

Use `Closes #<issue>` when the PR completely satisfies an Issue.

---

# Definition of Done

A story is complete only when:

- acceptance criteria are satisfied
- architecture boundaries are respected
- no format-specific logic has leaked into unrelated layers
- relevant tests exist
- lint passes
- TypeScript validation passes
- tests pass
- errors are handled
- offline behavior is preserved
- accessibility basics are preserved
- design-system tokens are respected
- no unrelated changes are included
- the PR documents verification performed

For reader-related work, validate on both iOS and Android whenever the necessary native environment is available.

After reading themes are implemented, validate all three reading themes for reader-related UI changes.

---

# Sprint order

Respect the planned dependency sequence.

## Sprint 0

Architecture, storage, reader contracts, design tokens and EAS foundations.

Do not start renderer implementation before the common contracts exist.

## Sprint 1

Library + complete minimal EPUB import flow.

Goal: first walking skeleton.

## Sprint 2

Complete EPUB reader.

Use this implementation to validate the Reader abstraction before adding other renderers.

## Sprint 3

Shared personalization and Ribbon.

Do not duplicate personalization logic inside individual renderers.

## Sprint 4

PDF import and reader.

Reuse existing import and Reader abstractions.

## Sprint 5

Images + CBZ.

Run the CBR spike separately.

Do not treat the CBR spike as permission to implement CBR unless the result is explicitly positive.

## Sprint 6

Reader and library refinements.

CBR may enter the sprint only after a successful spike.

## Sprint 7

Polish, QA and release.

Avoid large architecture changes during this sprint.

---

# Known specification gaps

Do not decide these implicitly.

## Integrated brightness

The product requirements mention app-controlled brightness, but the current backlog and sprint planning contain no corresponding story.

Do not implement it until a backlog decision/story is provided.

## Library list mode

The product requirements mention grid/list presentation, while the current backlog explicitly specifies the grid.

Treat grid as the currently planned MVP behavior unless instructed otherwise.

## Ribbon bookmark gesture

The design system describes a ribbon drag gesture for bookmarks, while the backlog only requires a manual bookmark action.

Implement the backlog acceptance criterion unless a dedicated gesture story is created.

## Reading themes on non-EPUB content

Do not modify PDF or image content colors unless the expected behavior is explicitly specified.

Application chrome may follow its UI/theme requirements independently of ebook content fidelity.

---

# Architectural changes

When a task requires changing a foundational decision:

1. do not silently perform the change;
2. explain why the existing design is insufficient;
3. add or update an ADR under `docs/adr/`;
4. keep the PR focused;
5. make migration/backward compatibility implications explicit.

Recommended ADRs include:

- reader abstraction
- SQLite schema
- filesystem layout
- import pipeline
- EPUB integration
- PDF rendering
- image rendering
- CBZ decompression
- CBR go/no-go decision

---

# Final Codex task behavior

For every task:

1. inspect repository instructions and relevant specifications;
2. inspect existing implementation before proposing changes;
3. identify dependencies and affected layers;
4. implement only the requested scope;
5. add/update tests;
6. run validation commands;
7. review the diff for duplication and architectural violations;
8. commit the changes;
9. leave the worktree clean;
10. provide a concise PR-ready summary including tests actually run and remaining risks.

Never mark work complete solely because the code compiles.
