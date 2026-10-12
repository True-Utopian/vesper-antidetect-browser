import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { durableWrite } from './storage.js';
export interface ProfileTemplate { id: string; name: string; revision: number; settings: Record<string, unknown>; createdAt: string }
export class ProfileCatalog {
  private templates: ProfileTemplate[] = [];
  constructor(private directory: string, private validate: (settings: Record<string, unknown>) => unknown) {}
  async init() { try { this.templates = JSON.parse(await readFile(join(this.directory,'templates.json'),'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; } }
  list() { return structuredClone(this.templates); }
  get(id: string) { const template = this.templates.find(x => x.id === id); if (!template) throw Object.assign(new Error('Template not found'), { status: 404 }); return structuredClone(template); }
  async save(name: unknown, settings: unknown, id?: string) {
    if (typeof name !== 'string' || !name.trim() || name.length > 120 || !settings || typeof settings !== 'object' || Array.isArray(settings)) throw Object.assign(new Error('Invalid template'), { status: 400 });
    if ('proxy' in settings || 'savedProxy' in settings) throw Object.assign(new Error('Templates do not copy proxy credentials. Assign a proxy to each profile.'), { status: 400 });
    this.validate(settings as Record<string, unknown>);
    const template: ProfileTemplate = { id: id ?? randomUUID(), name: name.trim(), settings: structuredClone(settings) as Record<string, unknown>, revision: id ? this.get(id).revision + 1 : 1, createdAt: new Date().toISOString() };
    this.templates = [...this.templates.filter(x => x.id !== template.id), template];
    await durableWrite(join(this.directory,'templates.json'),JSON.stringify(this.templates)); return structuredClone(template);
  }
}
