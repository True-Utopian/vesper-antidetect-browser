import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectQualificationProcesses} from '../src/native-qualification-cleanup.mjs';
const executable='C:\\Vesper\\chrome.exe',root='C:\\Temp\\vesper-kernel-proof-a1B2c3';
const record=(data:string,overrides={})=>({pid:123,created:'2026-11-03T22:00:00.0000000Z',executable,commandLine:`chrome.exe --type=renderer --user-data-dir="${data}"`,...overrides});
test('qualification cleanup selects exact owned root and child stores case-insensitively',()=>{
  assert.deepEqual(selectQualificationProcesses([record(root),record(root+'\\invalid-fallback',{pid:124})],executable,root).map(value=>value.pid),[123,124]);
  assert.equal(selectQualificationProcesses([record(root.toLowerCase())],executable.toUpperCase(),root).length,1);
});
test('qualification cleanup preserves operator profiles, sibling fixtures and other executable instances',()=>{
  const records=[record('C:\\Users\\Operator\\Browser'),record(root+'-other\\invalid-fallback'),record(root,{executable:'C:\\Other\\chrome.exe'}),record(root+'\\..\\operator')];
  assert.deepEqual(selectQualificationProcesses(records,executable,root),[]);
  assert.deepEqual(selectQualificationProcesses([record(root)],executable,'C:\\Temp'),[]);
});
test('qualification cleanup refuses ambiguous flags, missing creation identity and invalid process IDs',()=>{
  const records=[record(root,{commandLine:`chrome.exe --user-data-dir="${root}" --user-data-dir=C:\\Users\\Operator`}),record(root,{created:''}),record(root,{pid:0}),record(root,{commandLine:'chrome.exe --type=renderer'})];
  assert.deepEqual(selectQualificationProcesses(records,executable,root),[]);
});
