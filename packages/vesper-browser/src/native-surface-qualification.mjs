import assert from 'node:assert/strict';

/** Original fixture observation only; no identity getters are replaced. */
export async function observeNativeSurfacePolicies(probeEnumeration = false) {
  const canvas = () => typeof document === 'undefined' ? new OffscreenCanvas(64,32) : Object.assign(document.createElement('canvas'),{width:64,height:32});
  const result = {graphics:[],audio:null,fonts:null};
  for(const api of ['webgl','webgl2']){
    const gl=canvas().getContext(api);
    if(!gl){result.graphics.push(null);continue;}
    const advertised=gl.getSupportedExtensions().includes('WEBGL_debug_renderer_info');
    const debug=gl.getExtension('WEBGL_debug_renderer_info');
    const illegal=gl.getParameter(0x9245),error=gl.getError();
    result.graphics.push({api,advertised,enabled:!!debug,illegal,error});
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  if(typeof OfflineAudioContext!=='undefined'){
    const context=new OfflineAudioContext(2,512,44100);
    const oscillator=context.createOscillator();oscillator.type='triangle';oscillator.frequency.value=997;
    const compressor=context.createDynamicsCompressor();
    oscillator.connect(compressor);compressor.connect(context.destination);oscillator.start();
    const bits=values=>[...new Uint32Array(values.buffer,values.byteOffset,values.length)];
    let completed;
    context.oncomplete=event=>{completed=bits(event.renderedBuffer.getChannelData(0));};
    const buffer=await context.startRendering(),channel=buffer.getChannelData(0);
    const first=bits(channel),repeat=bits(buffer.getChannelData(0));
    const copied=new Float32Array(512);buffer.copyFromChannel(copied,0);
    const crop=new Float32Array(17);buffer.copyFromChannel(crop,0,19);
    const secondChannel=bits(buffer.getChannelData(1));
    channel[23]=0.125;const edited=new Float32Array(1);buffer.copyFromChannel(edited,0,23);
    result.audio={first,repeat,copied:bits(copied),crop:bits(crop),secondChannel,completed,sharedReadSemantics:buffer.getChannelData(0)===channel&&edited[0]===0.125};
  }
  const text=canvas().getContext('2d');
  if(text&&typeof FontFace!=='undefined'){
    const measure=family=>['mmmmmmmm','WWiii123','Vesper by true-utopian'].map(value=>{text.font=`16px ${family}, monospace`;return text.measureText(value).width;});
    const families=['Comic Sans MS','Consolas','Calibri','Georgia','Impact','Cambria','Lato'];
    const named={};for(const family of families)named[family]=measure(`"${family}"`);
    const local=[];
    for(const name of ['Arial','Consolas','Calibri','DejaVu Sans','Liberation Sans']){
      const face=new FontFace('owned-vesper-probe',`local("${name}")`);
      try{await face.load();local.push({name,loaded:true});}catch(error){local.push({name,loaded:false,error:error.name});}
    }
    let enumeration=null;
    if(probeEnumeration&&typeof queryLocalFonts==='function'){
      try{const values=await queryLocalFonts();enumeration={resolved:true,count:values.length};}catch(error){enumeration={resolved:false,error:error.name};}
    }
    result.fonts={fallback:measure('monospace'),allowed:measure('Arial'),named,local,enumeration};
  }
  return result;
}

export function assertSurfaceObservations(value,context){
  assert.ok(value&&Array.isArray(value.graphics),`${context}: missing surface observations`);
  if(value.audio){
    const audio=value.audio;
    assert.equal(audio.first.length,512,`${context}: complete audio fixture`);
    assert.deepEqual(audio.repeat,audio.first,`${context}: accumulating channel reads`);
    assert.deepEqual(audio.copied,audio.first,`${context}: copyFromChannel contradiction`);
    assert.deepEqual(audio.crop,audio.first.slice(19,36),`${context}: audio offset mismatch`);
    assert.deepEqual(audio.completed,audio.first,`${context}: completion event/promise mismatch`);
    assert.equal(audio.sharedReadSemantics,true,`${context}: channel writes must preserve API semantics`);
  }
}

export function assertRestrictedSurfaces(reference,candidate,context,requireEnumeration=false){
  assertSurfaceObservations(candidate,context);
  for(const graphic of candidate.graphics){
    if(!graphic)continue;
    assert.equal(graphic.advertised,false,`${context}/${graphic.api}: renderer extension is advertised`);
    assert.equal(graphic.enabled,false,`${context}/${graphic.api}: renderer extension is enabled`);
    assert.equal(graphic.illegal,null,`${context}/${graphic.api}: unmasked renderer enum is exposed`);
    assert.equal(graphic.error,0x500,`${context}/${graphic.api}: unsupported enum must retain INVALID_ENUM`);
  }
  if(reference.fonts){
    assert.ok(candidate.fonts,`${context}: missing font observations`);
    assert.deepEqual(candidate.fonts.allowed,reference.fonts.allowed,`${context}: essential family metrics changed`);
    assert.ok(candidate.fonts.local.every(value=>!value.loaded),`${context}: CSS local() exposes a unique face`);
    for(const [family,metrics] of Object.entries(candidate.fonts.named))assert.deepEqual(metrics,candidate.fonts.fallback,`${context}: named local family ${family} remains visible`);
  }
  if(reference.audio){
    assert.ok(candidate.audio,`${context}: missing audio observations`);
    assert.notDeepEqual(candidate.audio.first,reference.audio.first,`${context}: audio seed is not enforced`);
    for(let i=0;i<512;i++)assert.equal((candidate.audio.first[i]>>>3),(reference.audio.first[i]>>>3),`${context}: audio changes exceed the mantissa policy`);
  }
  if(requireEnumeration){
    assert.ok(candidate.graphics.filter(Boolean).length===2,`${context}: both WebGL APIs are required`);
    assert.ok(candidate.audio&&candidate.fonts,`${context}: page audio and font fixtures are required`);
    assert.deepEqual(candidate.fonts.enumeration,{resolved:false,error:'SecurityError'},`${context}: local font enumeration is not denied before prompting`);
    assert.ok(reference.fonts.local.some(value=>value.loaded),`${context}: baseline must resolve an actual installed local font`);
    assert.ok(Object.values(reference.fonts.named).some(value=>JSON.stringify(value)!==JSON.stringify(reference.fonts.fallback)),`${context}: baseline must expose an actual non-allowed local family`);
  }
}
