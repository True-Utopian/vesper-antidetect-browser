import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VesperBrowser } from '../src/index.js';

test('favorite metadata remains a strict boolean through partial edits and restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vesper-favorite-'));
  const browser = new VesperBrowser({ directory, executablePath: process.execPath });
  let favoriteId: string;
  let ordinaryId: string;
  try {
    favoriteId = (await browser.create({ name: 'Favorite profile', favorite: true })).id;
    ordinaryId = (await browser.create({ name: 'Ordinary profile', favorite: false })).id;
    const unset = await browser.create({ name: 'Unspecified favorite' });
    assert.equal((await browser.readProfile(unset.id)).settings.favorite, undefined);
    await browser.update(favoriteId, { notes: 'Editing another field must preserve the star' });
    assert.equal((await browser.readProfile(favoriteId)).settings.favorite, true);
    for (const invalid of ['true', 'false', 1, 0, null, [], {}]) {
      await assert.rejects(browser.create({ favorite: invalid }), /Invalid favorite/);
      await assert.rejects(browser.update(favoriteId, { favorite: invalid }), /Invalid favorite/);
    }
    assert.equal((await browser.listProfiles()).length, 3, 'Invalid creation must not leave a profile behind');
    assert.equal((await browser.readProfile(favoriteId)).settings.favorite, true, 'Invalid edits must not change the stored star');
  } finally { await browser.close(); }
  const reopened = new VesperBrowser({ directory, executablePath: process.execPath });
  try {
    assert.equal((await reopened.readProfile(favoriteId!)).settings.favorite, true);
    assert.equal((await reopened.readProfile(ordinaryId!)).settings.favorite, false);
    await reopened.update(favoriteId!, { favorite: false });
    await reopened.update(ordinaryId!, { favorite: true });
    assert.equal((await reopened.readProfile(favoriteId!)).settings.favorite, false);
    assert.equal((await reopened.readProfile(ordinaryId!)).settings.favorite, true);
  } finally { await reopened.close(); await rm(directory, { recursive: true, force: true }); }
});
