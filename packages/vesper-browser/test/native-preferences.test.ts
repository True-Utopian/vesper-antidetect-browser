import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareNativePreferences, validateFingerprint } from '../src/native-preferences.js';
import { VesperBrowser } from '../src/browser.js';

test('managed native preferences preserve unrelated settings and replace stale protection exceptions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vesper-native-prefs-'));
  const file = join(directory, 'Default', 'Preferences');
  try {
    await mkdir(join(directory, 'Default'));
    await writeFile(file, JSON.stringify({ intl: { selected_languages: 'de' }, bookmark: { retained: true }, profile: {
      default_content_setting_values: { notifications: 2 }, content_settings: { exceptions: {
        fingerprintingV2: { 'https://owned.fixture,*': { setting: 1 } }, notifications: { saved: true },
      } },
    } }));
    await prepareNativePreferences(directory, { engine: 'brave', locale: 'fr-fr', fingerprint: { protection: 'standard' } });
    let preferences = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(preferences.intl.accept_languages, 'fr-FR');
    assert.equal(preferences.intl.selected_languages, 'de');
    assert.equal(preferences.bookmark.retained, true);
    assert.equal(preferences.profile.default_content_setting_values.fingerprintingV2, 3);
    assert.equal(preferences.profile.default_content_setting_values.notifications, 2);
    assert.deepEqual(preferences.profile.content_settings.exceptions.notifications, { saved: true });
    assert.equal(preferences.profile.content_settings.exceptions.fingerprintingV2, undefined);
    await prepareNativePreferences(directory, { engine: 'brave', fingerprint: { protection: 'off' } });
    preferences = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(preferences.profile.default_content_setting_values.fingerprintingV2, 1);
    await writeFile(file, '{malformed');
    await assert.rejects(prepareNativePreferences(directory, { engine: 'brave' }), SyntaxError);
    assert.equal(await readFile(file, 'utf8'), '{malformed', 'A malformed user preference file must not be replaced');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('native fingerprint requests reject fabricated modes and validate merged profile edits before mutation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vesper-native-settings-'));
  const browser = new VesperBrowser({ directory, executablePath: process.execPath });
  try {
    for (const value of [null, [], {}, { protection: ['standard'] }, { protection: 'custom' }, { protection: 'standard', seed: 10 }]) assert.throws(() => validateFingerprint(value));
    await assert.rejects(browser.create({ fingerprint: { protection: 'standard' } }), /requires Brave or Vesper/);
    await assert.rejects(browser.create({ engine: ['brave'] }), /Invalid browser engine/);
    const { id } = await browser.create({ engine: 'brave', fingerprint: { protection: 'standard' } });
    await browser.update(id, { fingerprint: { protection: 'off' } });
    await browser.update(id, { fingerprint: { protection: 'standard' } });
    await assert.rejects(browser.update(id, { engine: 'chromium', proxy: { value: 'http', extra: { host: '127.0.0.1', port: 9999 } } }), /requires Brave or Vesper/);
    const profile = await browser.readProfile(id);
    assert.equal(profile.settings.engine, 'brave');
    assert.equal(profile.hasProxy, false, 'Rejected combined edits must not mutate the proxy vault');
    assert.equal(profile.revision, 3);
    await browser.update(id, { engine: 'chromium', fingerprint: { protection: 'off' } });
    assert.equal((await browser.fingerprintReport(id)).requestedProtection, 'off');
    assert.equal((await browser.fingerprintReport(id)).policyOwnerConnected, false);
  } finally { await browser.close(); await rm(directory, { recursive: true, force: true }); }
});
