/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import appConfig from '../../app.json';
import easConfig from '../../eas.json';
import packageConfig from '../../package.json';

const APPLICATION_IDENTIFIER = 'com.bakerscript.reebbon';
const EAS_PROJECT_ID = 'b8da9029-7d4b-4fb3-b625-a59a85cdaef0';

test('EAS Build profiles keep their intended distribution semantics', () => {
  assert.equal(easConfig.cli.appVersionSource, 'remote');
  assert.equal(easConfig.build.development.developmentClient, true);
  assert.equal(easConfig.build.development.distribution, 'internal');
  assert.equal(easConfig.build.preview.distribution, 'internal');
  assert.equal(easConfig.build.production.autoIncrement, true);
  assert.ok(packageConfig.dependencies['expo-dev-client']);
});

test('EAS project and native application identifiers remain explicit', () => {
  assert.equal(appConfig.expo.extra.eas.projectId, EAS_PROJECT_ID);
  assert.equal(appConfig.expo.android.package, APPLICATION_IDENTIFIER);
  assert.equal(appConfig.expo.ios.bundleIdentifier, APPLICATION_IDENTIFIER);
});
