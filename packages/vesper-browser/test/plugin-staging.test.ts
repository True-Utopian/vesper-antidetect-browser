import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {stagePluginPayload} from '../../../scripts/plugin-staging.mjs';

test('signed add-on staging cannot retain removed dependencies from an earlier build',async()=>{
  const base=resolve(import.meta.dirname,'../../../.workbench');await mkdir(base,{recursive:true});
  const fixture=await mkdtemp(join(base,'plugin-staging-test-'));
  try{
    const source=join(fixture,'source');await mkdir(source);
    await writeFile(join(source,'package.json'),'{}');
    const first=await stagePluginPayload({root:fixture,source,platform:'win32'});
    await mkdir(join(first,'payload/node_modules/obsolete'),{recursive:true});
    await writeFile(join(first,'payload/node_modules/obsolete/package.json'),'old retained evidence');
    await writeFile(join(source,'package.json'),'{"version":"new"}');
    const second=await stagePluginPayload({root:fixture,source,platform:'win32'});
    assert.notEqual(first,second);
    assert.equal(await readFile(join(second,'payload/package.json'),'utf8'),'{"version":"new"}');
    await assert.rejects(readFile(join(second,'payload/node_modules/obsolete/package.json')),{code:'ENOENT'});
    assert.equal(await readFile(join(first,'payload/node_modules/obsolete/package.json'),'utf8'),'old retained evidence');
  }finally{
    assert.equal(await realpath(fixture),fixture);assert.ok(relative(base,fixture).startsWith('plugin-staging-test-'));
    await rm(fixture,{recursive:true});
  }
});
