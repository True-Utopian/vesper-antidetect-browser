'use strict';
const $ = selector => document.querySelector(selector);
const node = (tag, text, className) => { const item = document.createElement(tag); if (text !== undefined) item.textContent = text; if (className) item.className = className; return item; };
const methods = ['get', 'post', 'patch', 'delete', 'put', 'head', 'options'];
let context, contract, guides, endpoints, copyTimer;
function addText(parent, text) { parent.append(node('p', text)); }
function link(text, hash) { const a = node('a', text); a.href = '#' + encodeURIComponent(hash); return a; }
function title(text) { $('#article').replaceChildren(node('h1', text)); return $('#article'); }
function navigate() {
  const query = $('#search').value.trim().toLowerCase(), method = $('#method').value;
  const visibleGuides = guides.filter(g => !method && (g.title + ' ' + g.sections.map(s => s.title + ' ' + s.text).join(' ')).toLowerCase().includes(query));
  const visibleEndpoints = endpoints.filter(e => (!method || e.method.toUpperCase() === method) && (e.path + ' ' + e.method + ' ' + (e.operation.summary || '') + ' ' + (e.operation.description || '')).toLowerCase().includes(query));
  const nav = $('#navigation'); nav.replaceChildren(link('Overview', 'overview'));
  if (visibleGuides.length) { nav.append(node('h2', 'Guides')); for (const g of visibleGuides) nav.append(link(g.title, 'guide:' + g.id)); }
  let lastGroup;
  for (const endpoint of visibleEndpoints) {
    const group = endpoint.path.replace(/^\/api\/v1\//, '/').split('/')[1] || 'API';
    if (group !== lastGroup) { nav.append(node('h2', group[0].toUpperCase() + group.slice(1))); lastGroup = group; }
    const a = link('', endpoint.key); a.append(node('span', endpoint.method.toUpperCase(), 'method ' + endpoint.method), node('span', endpoint.path.replace(/^\/api\/v1/, ''), 'path')); nav.append(a);
  }
  $('#result-count').textContent = `${visibleEndpoints.length} endpoints · ${visibleGuides.length} guides`;
  const selected = decodeHash(); for (const a of nav.querySelectorAll('a')) { if (a.hash === '#' + encodeURIComponent(selected)) a.setAttribute('aria-current', 'page'); }
  if (!visibleEndpoints.length && !visibleGuides.length) nav.append(node('p', 'No matches. Try a path such as profiles or clear the method filter.', 'schema-empty'));
}
function decodeHash() { try { return decodeURIComponent(location.hash.slice(1)) || 'overview'; } catch { return 'overview'; } }
function overview() {
  const article = title(`Vesper ${context.product} API`);
  addText(article, 'Build against the application running on this PC. Browse its bundled contract, inspect schemas and copy examples for your own scripts.');
  article.append(node('p', 'Documentation is read-only. Opening this page does not start browsers or runs. Requests from your scripts still require the instance’s private access token.', 'note'));
  article.append(node('h2', 'Your local service'), node('pre', `${location.origin}${context.apiBase}\nApplication ${context.version}   API ${context.apiVersion}`));
  addText(article, context.product === 'Browser' ? 'Browser owns profiles, native engine settings, proxies and run leases. Workbench is an optional add-on with its own service and token. Open its API Docs from Workbench when installed and enabled.' : 'Workbench runs scripts and published flows, schedules work and saves verified archives. Profile storage and native browser settings belong to Browser; each service uses its own token.');
  article.append(node('h2', 'Start here'));
  const list = node('div', undefined, 'guide-links');
  for (const g of guides) { const a = link(g.title, 'guide:' + g.id); a.append(node('small', g.description)); list.append(a); } article.append(list);
  article.append(node('h2', 'Endpoint reference')); addText(article, `${endpoints.length} versioned operations are listed in the navigation. Search by path, method or description. Download OpenAPI for the full machine-readable contract.`);
}
function guide(g) {
  const article = title(g.title); addText(article, g.description);
  for (const section of g.sections) { article.append(node('h2', section.title)); addText(article, section.text); if (section.code) article.append(node('pre', section.code.replaceAll('$ORIGIN', location.origin))); }
}
function resolve(schema) { if (schema?.$ref?.startsWith('#/')) return schema.$ref.slice(2).split('/').reduce((v, k) => v?.[k.replaceAll('~1', '/').replaceAll('~0', '~')], contract) || schema; return schema; }
function schemaView(parent, heading, schema) {
  parent.append(node('h3', heading));
  if (!schema || !Object.keys(schema).length) { parent.append(node('p', 'No detailed schema is declared for this response. Check the operation description and lifecycle guide.', 'schema-empty')); return; }
  const value = resolve(schema);
  if (value.properties) {
    const wrap = node('div', undefined, 'table-wrap'), table = node('table'), row = node('tr'); for (const text of ['Field', 'Type', 'Details']) row.append(node('th', text)); const head = node('thead'); head.append(row); table.append(head); const body = node('tbody');
    for (const [name, field] of Object.entries(value.properties)) { const f = resolve(field), r = node('tr'), details = [value.required?.includes(name) ? 'Required.' : 'Optional.', f.description, f.enum ? 'Allowed: ' + f.enum.join(', ') : '', f.minimum !== undefined ? 'Minimum: ' + f.minimum : '', f.maximum !== undefined ? 'Maximum: ' + f.maximum : ''].filter(Boolean).join(' '); r.append(node('td', name), node('td', f.type || (f.enum ? 'enum' : f.anyOf || f.oneOf ? 'choice' : 'object')), node('td', details)); body.append(r); } table.append(body); wrap.append(table); parent.append(wrap);
  }
  const details = node('details'); details.append(node('summary', 'View JSON schema'), node('pre', JSON.stringify(value, null, 2))); parent.append(details);
}
function exampleValue(schema, depth = 0) {
  if (depth > 5) return {};
  schema = resolve(schema) || {};
  if (schema.example !== undefined) return schema.example;
  if (schema.enum) return schema.enum[0];
  if (schema.anyOf || schema.oneOf) return exampleValue((schema.anyOf || schema.oneOf)[0], depth + 1);
  if (schema.type === 'object' || schema.properties) return Object.fromEntries(Object.entries(schema.properties || {}).filter(([k]) => schema.required?.includes(k)).map(([k, v]) => [k, exampleValue(v, depth + 1)]));
  if (schema.type === 'array') return [];
  if (schema.type === 'integer' || schema.type === 'number') return schema.minimum ?? 1;
  if (schema.type === 'boolean') return false;
  return schema.format === 'uuid' ? '<profile-id>' : '<value>';
}
function example(endpoint, language) {
  const url = location.origin + endpoint.fullPath, operation = endpoint.operation, content = operation.requestBody?.content, type = content ? Object.keys(content)[0] : undefined;
  const path = endpoint.path.replace(/^\/api\/v1/, '');
  let sample = type === 'application/json' ? exampleValue(content[type].schema) : undefined;
  if (endpoint.method === 'post' && ['/profiles', '/local-profiles'].includes(path)) sample = { name: 'API example' };
  if (endpoint.method === 'post' && path === '/schedules/preview') sample = { cron: '0 9 * * 1-5', timezone: 'Europe/London', after: 1774688340000 };
  const payload = sample === undefined ? undefined : JSON.stringify(sample, null, 2);
  if (type && !payload) return `Binary request: ${type}\nRead the archive/extension guide before uploading a file.\n\n${endpoint.method.toUpperCase()} ${url}\nAuthorization: Bearer <your-token>\nContent-Type: ${type}`;
  if (language === 'Python') return `import json, os, urllib.request\n\n# Set VESPER_TOKEN privately for this ${context.product} instance.\nurl = ${JSON.stringify(url)}\nheaders = {"Authorization": "Bearer " + os.environ["VESPER_TOKEN"]${payload ? ', "Content-Type": "application/json"' : ''}}\n${payload ? 'body = ' + JSON.stringify(payload) + '.encode("utf-8")\n' : ''}request = urllib.request.Request(url, headers=headers, method=${JSON.stringify(endpoint.method.toUpperCase())}${payload ? ', data=body' : ''})\nwith urllib.request.urlopen(request, timeout=30) as response:\n    print(response.read().decode("utf-8"))`;
  if (language === 'TypeScript') return `// Set VESPER_TOKEN privately for this ${context.product} instance.\nconst token = process.env.VESPER_TOKEN;\nif (!token) throw new Error("Set VESPER_TOKEN");\nconst response = await fetch(${JSON.stringify(url)}, {\n  method: ${JSON.stringify(endpoint.method.toUpperCase())},\n  headers: { Authorization: \`Bearer \${token}\`${payload ? ', "Content-Type": "application/json"' : ''} },${payload ? '\n  body: JSON.stringify(' + payload + '),' : ''}\n});\nif (!response.ok) throw new Error(\`HTTP \${response.status}: \${await response.text()}\`);\nconsole.log(await response.text());`;
  return `# Set VESPER_TOKEN privately. Replace every <placeholder>.\ncurl --request ${endpoint.method.toUpperCase()} '${url}' \\\n  --header "Authorization: Bearer $VESPER_TOKEN"${payload ? ' \\\n  --header "Content-Type: application/json" \\\n  --data ' + "'" + payload + "'" : ''}`;
}
function endpointView(endpoint) {
  const article = $('#article'); article.replaceChildren(); const h = node('div', undefined, 'endpoint-heading'); h.append(node('span', endpoint.method.toUpperCase(), 'method ' + endpoint.method), node('h1', endpoint.path)); article.append(h); addText(article, endpoint.operation.summary || endpoint.operation.description || 'Versioned API operation.');
  const columns = node('div', undefined, 'reference-columns'), reference = node('section'), samples = node('section'); columns.append(reference, samples); article.append(columns);
  reference.append(node('h2', 'Request'));
  addText(reference, (endpoint.operation.security?.length === 0 ? 'Authentication: public operation.' : 'Authentication: Authorization: Bearer <your-token>.') + ' Documentation never retrieves or stores your token.');
  const params = endpoint.operation.parameters || [];
  if (params.length) {
    reference.append(node('h3', 'Parameters and headers'));
    const wrap = node('div', undefined, 'table-wrap'), table = node('table'), head = node('thead'), row = node('tr');
    for (const label of ['Parameter', 'Details']) row.append(node('th', label)); head.append(row); table.append(head); const body = node('tbody');
    for (const parameter of params) { const p = resolve(parameter), r = node('tr'), name = node('td'), description = node('td'); name.append(node('code', p.name), node('p', `${p.in} · ${p.required ? 'required' : 'optional'}`)); description.append(node('p', [p.schema?.type, p.description].filter(Boolean).join('. '))); r.append(name, description); body.append(r); } table.append(body); wrap.append(table); reference.append(wrap);
    const details = node('details'); details.append(node('summary', 'View parameter schemas'), node('pre', JSON.stringify(params, null, 2))); reference.append(details);
  }
  for (const [type, spec] of Object.entries(endpoint.operation.requestBody?.content || {})) schemaView(reference, 'Body · ' + type, spec.schema);
  reference.append(node('h2', 'Responses'));
  for (const [status, response] of Object.entries(endpoint.operation.responses || {})) { const detail = node('details'); detail.open = /^2/.test(status); detail.append(node('summary', status + ' · ' + (response.description || 'Response'))); for (const [type, spec] of Object.entries(response.content || {})) schemaView(detail, type, spec.schema); if (!Object.keys(response.content || {}).length) detail.append(node('p', 'No response body schema is declared in this contract. See the lifecycle guide for the returned record and its limits.', 'schema-empty')); reference.append(detail); }
  const head = node('div', undefined, 'example-head'), label = node('label', 'Example language'), select = node('select'); select.setAttribute('aria-label', 'Example language'); for (const value of ['TypeScript', 'Python', 'cURL']) select.append(node('option', value)); label.append(select); head.append(node('h2', 'Request example'), label); const code = node('pre', example(endpoint, select.value)), copy = node('button', 'Copy example'); copy.type = 'button';
  select.addEventListener('change', () => { code.textContent = example(endpoint, select.value); });
  copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(code.textContent); $('#copy-status').textContent = 'Example copied. Replace placeholders before running.'; } catch { $('#copy-status').textContent = 'Clipboard unavailable. Select the example text to copy it.'; } clearTimeout(copyTimer); copyTimer = setTimeout(() => { $('#copy-status').textContent = ''; }, 5000); });
  samples.append(head, code, copy, node('p', 'Examples are templates. Replace placeholders, inspect required fields and use an owned test profile. Nothing executes from this page.', 'schema-empty'));
}
function render() { const key = decodeHash(); if (key === 'overview') overview(); else if (key.startsWith('guide:')) { const g = guides.find(g => key === 'guide:' + g.id); g ? guide(g) : title('Guide not found'); } else { const e = endpoints.find(e => e.key === key); e ? endpointView(e) : title('Endpoint not found'); } navigate(); $('#content').scrollTop = 0; window.scrollTo(0, 0); }
async function start() {
  const load = async path => { const response = await fetch(path, { credentials: 'omit', cache: 'no-store' }); if (!response.ok) throw new Error('Reference returned HTTP ' + response.status); return response.json(); };
  [context, contract, guides] = await Promise.all([load('/docs/context.json'), load('/docs/openapi.json'), load('/docs/guides.json')]);
  guides = guides.filter(g => !g.product || g.product === context.product);
  const base = contract.servers?.[0]?.url || '/';
  endpoints = Object.entries(contract.paths).sort(([a], [b]) => a.localeCompare(b)).flatMap(([path, item]) => methods.filter(method => item[method]).map(method => ({ path, method, operation: item[method], key: method + ':' + path, fullPath: base.replace(/\/$/, '') + path })));
  $('#version').textContent = `${context.product} ${context.version} / API ${context.apiVersion}`;
  document.title = `Vesper ${context.product} API Docs by true-utopian`;
  $('#companion').textContent = context.product === 'Browser' ? 'Workbench is optional. Its own API Docs are available from the add-on.' : 'Workbench and Browser use separate services and tokens.';
  if (context.browserDocs) { $('#browser-docs').hidden = false; $('#browser-docs').href = context.browserDocs; }
  $('#search').addEventListener('input', navigate); $('#method').addEventListener('change', navigate); window.addEventListener('hashchange', render); render();
}
start().catch(error => { $('#error').hidden = false; $('#error').textContent = 'Could not load bundled documentation. Keep Vesper running and reload this page. ' + error.message; });
