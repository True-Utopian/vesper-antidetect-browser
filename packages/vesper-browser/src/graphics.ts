export type GraphicsBackend = 'default' | 'software';

/** Explicit rendering backend for Linux hosts without a GPU. Never disables a sandbox. */
export function graphicsArguments(backend: GraphicsBackend = 'default', platform: NodeJS.Platform = process.platform): string[] {
  if (backend !== 'default' && backend !== 'software') throw new Error('Graphics backend must be default or software');
  if (backend === 'default') return [];
  if (platform !== 'linux') throw new Error('Explicit software graphics is supported on Linux only');
  return ['--use-gl=angle', '--use-angle=swiftshader'];
}
