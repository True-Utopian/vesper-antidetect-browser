import test from'node:test';import assert from'node:assert/strict';
import{cookieSnapshot,validateCookies}from'../src/cookies.js';
test('cookie snapshots round-trip without CDP output fields, and reject malformed import values',()=>{
 const snapshot=cookieSnapshot([{name:'session',value:'owned',domain:'example.test',path:'/',expires:-1,secure:true,httpOnly:true,sameSite:'Lax',size:7,session:true} as any]);
 assert.deepEqual(validateCookies(snapshot),snapshot);assert.equal('session'in snapshot[0]!,false);
 for(const change of [{secure:'yes'},{expires:NaN},{path:'relative'},{sameSite:'Wrong'},{partitionKey:{sourceOrigin:'file:///tmp'}},{domain:'https://bad'}])assert.throws(()=>validateCookies([{...snapshot[0],...change}]));
});
