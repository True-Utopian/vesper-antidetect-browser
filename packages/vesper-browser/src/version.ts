import { readFileSync } from 'node:fs';

// Source and compiled modules both sit one directory below package.json.
export const vesperBrowserVersion: string = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
