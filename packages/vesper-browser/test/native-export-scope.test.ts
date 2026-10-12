import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deflateSync } from 'node:zlib';
import { assertNativeCanvasScope } from '../src/native-qualification.mjs';

// An independently assembled owned RGBA fixture, with PNG filter zero.
function png(pixels: number[]) {
  const chunk=(name:string,data:Buffer)=>{
    const tag=Buffer.from(name),body=Buffer.concat([tag,data]);let crc=0xffffffff;
    for(const value of body){crc^=value;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    const header=Buffer.alloc(4),tail=Buffer.alloc(4);header.writeUInt32BE(data.length);tail.writeUInt32BE((crc^0xffffffff)>>>0);
    return Buffer.concat([header,body,tail]);
  };
  const header=Buffer.alloc(13);header.writeUInt32BE(16);header.writeUInt32BE(8,4);header[8]=8;header[9]=6;
  const raw=Buffer.concat(Array.from({length:8},(_,y)=>Buffer.from([0,...pixels.slice(y*64,(y+1)*64)])));
  return [...Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])];
}
function fixture() {
  const pixels=Array.from({length:128},(_,i)=>[Math.floor(i/16)*20,40,60,255]).flat(),topDown=[];
  for(let y=7;y>=0;y--)topDown.push(...pixels.slice(y*64,(y+1)*64));
  const encoded=png(topDown);
  return {graphics:[{api:'webgl',error:0,pixels,repeat:[...pixels],encoded,dataUrl:`data:image/png;base64,${Buffer.from(encoded).toString('base64')}`}],topDown};
}
test('native Canvas2D scope gate independently normalizes GPU row orientation',()=>{
  assert.equal(assertNativeCanvasScope(fixture(),'owned-page'),1);
});
test('native Canvas2D scope gate rejects an export-only GPU policy effect',()=>{
  const blob=fixture();blob.topDown[0]!^=1;blob.graphics[0]!.encoded=png(blob.topDown);
  assert.throws(()=>assertNativeCanvasScope(blob,'owned-page'),/must not change GPU PNG export alone/);
  const url=fixture();url.topDown[0]!^=1;url.graphics[0]!.dataUrl=`data:image/png;base64,${Buffer.from(png(url.topDown)).toString('base64')}`;
  assert.throws(()=>assertNativeCanvasScope(url,'owned-page'),/data URL must agree/);
});
test('scope gate distinguishes absent APIs from missing observations and broken reads',()=>{
  assert.equal(assertNativeCanvasScope({graphics:[null,null]},'unsupported-worker'),0);
  assert.throws(()=>assertNativeCanvasScope({},'missing'),/observations are required/);
  const broken=fixture();broken.graphics[0]!.error=1282;
  assert.throws(()=>assertNativeCanvasScope(broken,'owned-page'),/read-out error/);
  const accumulating=fixture();accumulating.graphics[0]!.repeat[0]!^=1;
  assert.throws(()=>assertNativeCanvasScope(accumulating,'owned-page'),/must not accumulate/);
});
