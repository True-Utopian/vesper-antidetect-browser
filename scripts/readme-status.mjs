import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const data=JSON.parse(await readFile(resolve(root,'docs/status.json'),'utf8'));
const states=['verified','source_tested','in_progress','planned'],seen=new Set();
const counts=Object.fromEntries(states.map(state=>[state,0]));
if(data.schemaVersion!==1||!/^\d{4}-\d{2}-\d{2}$/.test(data.updated))throw Error('Invalid status inventory');
for(const group of data.groups)for(const check of group.checks){
 if(seen.has(check.id)||!states.includes(check.state)||!check.name||check.state!=='planned'&&!check.evidence)throw Error('Invalid status check '+check.id);
 seen.add(check.id);counts[check.state]++;if(check.evidence)await readFile(resolve(root,check.evidence));
}
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const totals=product=>{const checks=data.groups.filter(g=>g.product===product).flatMap(g=>g.checks),passed=checks.filter(c=>c.state==='verified').length;return {checks,passed,percent:(100*passed/checks.length).toFixed(2)};};

// Original renderer: compact badges and proportional grid treemaps following
// the requested reference layout. No reference code or artwork is included.
function badge(product){
 const {percent}=totals(product),label=product.toLowerCase()+'*',left=product==='Browser'?66:82,right=52,width=left+right;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${label}: ${percent}%"><title>${label}: ${percent}% of named checks desktop verified</title><rect width="${left}" height="20" fill="#555"/><rect x="${left}" width="${right}" height="20" fill="${percent==='100.00'?'#4c1':'#97ca00'}"/><g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11"><text x="${left/2}" y="14">${label}</text><text x="${left+right/2}" y="14">${percent}%</text></g></svg>\n`;
}
function partition(groups,box){
 if(groups.length===1)return [{group:groups[0],...box}];
 const weight=groups.reduce((sum,g)=>sum+g.checks.length,0);let sum=0,split=1,best=Infinity;
 for(let i=1;i<groups.length;i++){sum+=groups[i-1].checks.length;const distance=Math.abs(weight/2-sum);if(distance<best){best=distance;split=i;}}
 const first=groups.slice(0,split),second=groups.slice(split),ratio=first.reduce((sum,g)=>sum+g.checks.length,0)/weight;
 if(box.w>=box.h){const width=Math.max(6,Math.min(box.w-6,Math.round(box.w*ratio/6)*6));return [...partition(first,{...box,w:width}),...partition(second,{...box,x:box.x+width,w:box.w-width})];}
 const height=Math.max(6,Math.min(box.h-6,Math.round(box.h*ratio/6)*6));return [...partition(first,{...box,h:height}),...partition(second,{...box,y:box.y+height,h:box.h-height})];
}
const svg=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 310" width="1000" height="310" role="img" aria-labelledby="status-title status-description"><title id="status-title">Vesper acceptance progress</title><desc id="status-description">Two labelled grid treemaps. Green shows desktop verified checks; grey shows checks awaiting acceptance. Small squares are proportional visual texture, not additional checks. Percentages count the named inventory only.</desc><rect width="1000" height="310" fill="#0d1117"/>'];
for(const [index,product]of ['Browser','Workbench'].entries()){
 const {checks,passed,percent}=totals(product),x=index*510;
 svg.push(`<text x="${x+4}" y="21" fill="#fff" stroke="#0d1117" stroke-width="3" paint-order="stroke" font-family="sans-serif" font-size="16">Vesper ${product}*: ${percent}% (${passed}/${checks.length})</text>`);
 const groups=data.groups.filter(g=>g.product===product).sort((a,b)=>b.checks.length-a.checks.length);
 for(const region of partition(groups,{x:x+1,y:31,w:488,h:278})){
  const {group,x:rx,y:ry,w,h}=region,cols=Math.floor(w/6),rows=Math.floor(h/6),ordered=[...group.checks].sort((a,b)=>Number(b.state==='verified')-Number(a.state==='verified'));
  svg.push(`<g><title>${escape(group.name)}: ${ordered.filter(c=>c.state==='verified').length}/${ordered.length} desktop verified</title><rect x="${rx}" y="${ry}" width="${w}" height="${h}" fill="#0d1117"/>`);
  const paths={verified:[],pending:[]};
  for(let cell=0;cell<cols*rows;cell++){
   const check=ordered[Math.min(ordered.length-1,Math.floor(cell*ordered.length/(cols*rows)))],cx=rx+(cell%cols)*6,cy=ry+Math.floor(cell/cols)*6;
   paths[check.state==='verified'?'verified':'pending'].push(`M${cx} ${cy}h5.5v5.5h-5.5z`);
  }
  for(const [state,path]of Object.entries(paths))if(path.length)svg.push(`<path fill="${state==='verified'?'#2ea043':'#6e7681'}" d="${path.join('')}"/>`);
  const label={'Identity and rendering':'Fingerprint','Connections':'Proxies','Desktop and engines':'Engines','Run lifecycle':'Runs','Visual flows':'Flows','Integration':'API','Release and recovery':'Recovery'}[group.name]??group.name;
  svg.push(`<text x="${rx+2}" y="${ry+14}" fill="#fff" stroke="#0d1117" stroke-width="3" paint-order="stroke" font-family="sans-serif" font-size="13">${escape(label)}</text></g>`);
 }
}
svg.push('</svg>\n');
const summary=['# Status inventory','',`Updated ${data.updated}.`,'',data.scope,'','Green in the README treemap means desktop verified. Grey means acceptance is pending; source-tested, in-progress and planned states remain separate below. Treemap squares are visual texture proportional to these named checks, not extra checks.','',...data.groups.flatMap(group=>[`## ${group.product}: ${group.name}`,'','| Acceptance check | State | Evidence |','| --- | --- | --- |',...group.checks.map(check=>`| ${check.name} | ${check.state.replaceAll('_',' ')} | ${check.evidence?`[Evidence](../${check.evidence})`:'Pending'} |`),''])].join('\n').trimEnd()+'\n';
const outputs={'docs/assets/status.svg':svg.join(''),'docs/assets/badge-browser.svg':badge('Browser'),'docs/assets/badge-workbench.svg':badge('Workbench'),'docs/status.md':summary};
await mkdir(resolve(root,'docs/assets'),{recursive:true});
for(const [path,content]of Object.entries(outputs)){
 if(process.argv.includes('--check')){if(await readFile(resolve(root,path),'utf8')!==content)throw Error('Run node scripts/readme-status.mjs to refresh '+path);}
 else await writeFile(resolve(root,path),content);
}
console.log(JSON.stringify({checks:seen.size,counts,generated:!process.argv.includes('--check')}));
