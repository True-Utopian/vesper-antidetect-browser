import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assertSurfaceObservations,assertRestrictedSurfaces} from '../src/native-surface-qualification.mjs';

function observation(){
  const first=Array.from({length:512},(_,i)=>0x3f000000+i*8);
  return {graphics:[{api:'webgl',advertised:false,enabled:false,illegal:null,error:0x500},{api:'webgl2',advertised:false,enabled:false,illegal:null,error:0x500}],audio:{first,repeat:[...first],copied:[...first],crop:first.slice(19,36),secondChannel:[...first],completed:[...first],sharedReadSemantics:true},fonts:{fallback:[1,2,3],allowed:[4,5,6],named:{Consolas:[1,2,3]},local:[{name:'Arial',loaded:false,error:'NetworkError'}],enumeration:{resolved:false,error:'SecurityError'}}};
}
test('audio surface gate rejects read, offset, event and shared-buffer contradictions',()=>{
  const value=observation();assert.doesNotThrow(()=>assertSurfaceObservations(value,'owned'));
  for(const key of ['repeat','copied','crop','completed'] as const){const bad=structuredClone(value);bad.audio[key][0]^=1;assert.throws(()=>assertSurfaceObservations(bad,'owned'));}
  const bad=structuredClone(value);bad.audio.sharedReadSemantics=false;assert.throws(()=>assertSurfaceObservations(bad,'owned'));
});
test('surface admission requires genuine baseline exposure and bounded native changes',()=>{
  const reference=observation();reference.fonts.local[0].loaded=true;reference.fonts.named.Consolas=[9,10,11];
  const candidate=observation();for(const key of ['first','repeat','copied','crop','completed'] as const)candidate.audio[key]=candidate.audio[key].map(value=>value|1);
  assert.doesNotThrow(()=>assertRestrictedSurfaces(reference,candidate,'owned',true));
  const cases=[(bad:any)=>bad.graphics[0].advertised=true,(bad:any)=>bad.graphics[1].enabled=true,(bad:any)=>bad.graphics[0].illegal='GPU vendor',(bad:any)=>bad.graphics[0].error=0,(bad:any)=>bad.fonts.local[0].loaded=true,(bad:any)=>bad.fonts.named.Consolas=[8,9,10],(bad:any)=>bad.fonts.allowed=[7,8,9],(bad:any)=>bad.fonts.enumeration={resolved:true,count:1},(bad:any)=>bad.audio=structuredClone(reference.audio)];
  for(const change of cases){const bad=structuredClone(candidate);change(bad);assert.throws(()=>assertRestrictedSurfaces(reference,bad,'owned',true));}
  const highBit=structuredClone(candidate);for(const key of ['first','repeat','copied','completed'] as const)highBit.audio[key][40]^=8;assert.throws(()=>assertRestrictedSurfaces(reference,highBit,'owned',true));
  const absent=structuredClone(reference);absent.fonts.local[0].loaded=false;assert.throws(()=>assertRestrictedSurfaces(absent,candidate,'owned',true),/actual installed local font/);
});
