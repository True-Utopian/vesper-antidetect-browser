import test from 'node:test';
import assert from 'node:assert/strict';
import {graphicsArguments} from '../src/graphics.js';

test('Linux software rendering is opt-in and keeps sandbox flags intact',()=>{
  assert.deepEqual(graphicsArguments('default','linux'),[]);
  assert.deepEqual(graphicsArguments('default','win32'),[]);
  assert.deepEqual(graphicsArguments('software','linux'),['--use-gl=angle','--use-angle=swiftshader']);
  assert.throws(()=>graphicsArguments('software','win32'),/Linux only/);
  assert.throws(()=>graphicsArguments('invalid' as any,'linux'),/must be default or software/);
});
