/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { appUiThemes, designSystemTokens, getNavigationTheme } from '../../../src/shared/theme';

test('design system tokens expose the Reebbon palette, type families, spacing, radii, and motion', () => {
  assert.equal(designSystemTokens.colors.ink, '#35304C');
  assert.equal(designSystemTokens.colors.oxbloodTint, '#D98C7A');
  assert.equal(designSystemTokens.colors.nightText, '#C9C0AE');
  assert.equal(designSystemTokens.spacing[4], 16);
  assert.equal(designSystemTokens.radii.md, 14);
  assert.equal(designSystemTokens.motion.uiTransition, 260);
  assert.equal(designSystemTokens.typography.families.display, 'Fraunces');
  assert.equal(designSystemTokens.typography.families.ui, 'Public Sans');
  assert.equal(designSystemTokens.typography.families.reading, 'Literata');
  assert.equal(designSystemTokens.typography.families.mono, 'IBM Plex Mono');
});

test('application UI themes derive light chrome from Paper and dark chrome from Walnut', () => {
  assert.equal(appUiThemes.light.background, designSystemTokens.colors.paper);
  assert.equal(appUiThemes.light.surface, designSystemTokens.colors.paper2);
  assert.equal(appUiThemes.light.text, designSystemTokens.colors.paperText);
  assert.equal(appUiThemes.dark.background, designSystemTokens.colors.walnut);
  assert.equal(appUiThemes.dark.surface, designSystemTokens.colors.walnut2);
  assert.equal(appUiThemes.dark.text, designSystemTokens.colors.walnutText);
  assert.equal(appUiThemes.dark.accent, designSystemTokens.colors.oxbloodTint);
});

test('navigation theme mirrors the semantic application theme for each UI mode', () => {
  const lightTheme = getNavigationTheme('light');
  const darkTheme = getNavigationTheme('dark');

  assert.equal(lightTheme.dark, false);
  assert.equal(lightTheme.colors.background, appUiThemes.light.background);
  assert.equal(lightTheme.colors.card, appUiThemes.light.surface);
  assert.equal(lightTheme.colors.primary, appUiThemes.light.accent);

  assert.equal(darkTheme.dark, true);
  assert.equal(darkTheme.colors.background, appUiThemes.dark.background);
  assert.equal(darkTheme.colors.card, appUiThemes.dark.surface);
  assert.equal(darkTheme.colors.text, appUiThemes.dark.text);
});
