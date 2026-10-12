import type{CookieData,Cookie}from'puppeteer-core';
const keys=['name','value','domain','path','expires','httpOnly','secure','sameSite','partitionKey'];
export function cookieSnapshot(cookies:Cookie[]):CookieData[]{return cookies.map(cookie=>Object.fromEntries(Object.entries(cookie).filter(([key])=>keys.includes(key))) as unknown as CookieData);}
export function validateCookies(value:unknown):CookieData[]{
 if(!Array.isArray(value)||value.length>1000)throw new Error('Invalid JSON cookie list');
 for(const cookie of value){
  if(!cookie||typeof cookie!=='object'||Array.isArray(cookie)||Object.keys(cookie).some(key=>!keys.includes(key))||typeof cookie.name!=='string'||!cookie.name||cookie.name.length>256||typeof cookie.value!=='string'||cookie.value.length>4096||typeof cookie.domain!=='string'||!cookie.domain||/[\s/:]/.test(cookie.domain)||cookie.domain.length>253)throw new Error('Invalid JSON cookie list');
  if(cookie.path!==undefined&&(typeof cookie.path!=='string'||!cookie.path.startsWith('/')||cookie.path.length>2048))throw new Error('Invalid cookie path');
  if(cookie.expires!==undefined&&(!Number.isFinite(cookie.expires)||cookie.expires< -1||cookie.expires>1e12))throw new Error('Invalid cookie expiry');
  for(const key of ['secure','httpOnly'])if(cookie[key]!==undefined&&typeof cookie[key]!=='boolean')throw new Error('Invalid cookie flags');
  if(cookie.sameSite!==undefined&&!['Strict','Lax','None','Default'].includes(cookie.sameSite))throw new Error('Invalid cookie SameSite');
  if(cookie.partitionKey!==undefined){const p=cookie.partitionKey;if(typeof p!=='string'&&(!p||typeof p!=='object'||Object.keys(p).some(k=>!['sourceOrigin','hasCrossSiteAncestor'].includes(k))||p.hasCrossSiteAncestor!==undefined&&typeof p.hasCrossSiteAncestor!=='boolean'))throw new Error('Invalid cookie partition');
   const url=new URL(typeof p==='string'?p:p.sourceOrigin);if(!['http:','https:'].includes(url.protocol)||url.origin!==(typeof p==='string'?p:p.sourceOrigin))throw new Error('Invalid cookie partition');
  }
 }
 return structuredClone(value);
}
