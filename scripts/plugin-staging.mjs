import assert from 'node:assert/strict';
import {cp,mkdir,mkdtemp,realpath} from 'node:fs/promises';
import {join,relative} from 'node:path';

/** Keep each signed add-on build separate from all previous payload snapshots. */
export async function stagePluginPayload({root,source,platform}) {
  assert.ok(['win32','linux'].includes(platform),'Unsupported add-on platform');
  root=await realpath(root);source=await realpath(source);
  const parent=join(root,'.workbench','workbench-plugin-staging');
  await mkdir(parent,{recursive:true});
  assert.equal(relative(root,await realpath(parent)),join('.workbench','workbench-plugin-staging'),'Add-on staging must remain in the active checkout');
  const stage=await mkdtemp(join(parent,platform+'-'));
  await cp(source,join(stage,'payload'),{recursive:true,dereference:true});
  return stage;
}
