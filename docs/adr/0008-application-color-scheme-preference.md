# ADR 0008: Application color-scheme preference

- Status: Accepted
- Date: 2026-09-03
- Backlog: PERS-04

## Context

Reebbon already exposes semantic Paper and Walnut tokens for application chrome, but the active theme follows the device and is not persisted. Reading themes are a separate EPUB concern and must remain independent.

## Decision

Represent the application color scheme as the domain union `light | dark`, with `light` as the deterministic default. Persist the selected value under `application.color-scheme` through the existing application-preference repository and SQLite table.

An application-level service validates reads and serializes writes. The Expo composition root injects its local adapter into a presentation provider, which applies the choice to navigation, status bar, and all components consuming semantic application tokens. The library exposes the two accessible choices without introducing the settings sheet reserved for PERS-05.

Reading themes continue to use the separate `paper | sepia | night` model and are never inferred from the application preference.

## Consequences

- A fresh or unreadable preference uses Paper-based light chrome.
- Walnut-based dark chrome uses Oxblood Tint through existing semantic tokens.
- Preference failures are typed before presentation and reported without crashing.
- No database migration is needed because the generic preferences table already exists.
