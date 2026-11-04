import { readFile } from 'node:fs/promises';

// This allowlist is shared by the independent Browser and Workbench servers.
// Documentation contains contracts only: never runtime profiles, tokens or inputs.
const assets: Record<string, [string, string]> = {
  '/docs': ['index.html', 'text/html; charset=utf-8'],
  '/docs/': ['index.html', 'text/html; charset=utf-8'],
  '/docs/app.js': ['app.js', 'application/javascript; charset=utf-8'],
  '/docs/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/docs/guides.json': ['guides.json', 'application/json; charset=utf-8'],
  '/docs/vesper-mark.svg': ['../vesper-mark.svg', 'image/svg+xml'],
};

export async function documentationAsset(pathname: string) {
  if (pathname.startsWith('/docs/handbook/')) {
    const path = pathname.slice('/docs/handbook/'.length);
    // Only generated public files named by the bundled manifest are eligible.
    // Do not decode or normalize arbitrary paths into this public directory.
    if (!/^(?:[a-z][a-z0-9-]*\.(?:html|json|txt)|LICENSE\.txt|(?:assets|wiki)\/[a-z][a-z0-9-]*\.(?:html|svg|css|js|png))$/.test(path)) return undefined;
    const root = new URL('../public/docs/handbook/', import.meta.url);
    let manifest: { schemaVersion?: number; files?: unknown };
    try { manifest = JSON.parse(await readFile(new URL('offline-manifest.json', root), 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
    if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files) || !manifest.files.includes(path)) return undefined;
    const types: Record<string,string> = { html:'text/html; charset=utf-8', json:'application/json; charset=utf-8', txt:'text/plain; charset=utf-8', css:'text/css; charset=utf-8', js:'application/javascript; charset=utf-8', svg:'image/svg+xml', png:'image/png' };
    const type = types[path.split('.').at(-1)!];
    if (!type) return undefined;
    return { type, body: await readFile(new URL(path, root)) };
  }
  const entry = assets[pathname];
  if (!entry) return undefined;
  return { type: entry[1], body: await readFile(new URL(`../public/docs/${entry[0]}`, import.meta.url)) };
}

export function documentationContext(product: 'Browser' | 'Workbench', version: string, browserOrigin?: string) {
  let browserDocs: string | undefined;
  if (browserOrigin) {
    const url = new URL(browserOrigin);
    if (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !url.username && !url.password) browserDocs = new URL('/docs', url.origin).href;
  }
  return { product, author: 'true-utopian', version, apiVersion: '1.0', apiBase: '/api/v1', schema: '/docs/openapi.json', browserDocs };
}

/** Fastify also emits legacy paths. Document each versioned operation once. */
export function versionedDocumentationContract(contract: any) {
  return { ...contract, servers: [{ url: '/' }], paths: Object.fromEntries(Object.entries(contract.paths ?? {}).filter(([path]) => path.startsWith('/api/v1/'))) };
}
