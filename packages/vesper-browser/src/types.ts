/** Proxy credentials are stored in the profile vault, never the public manifest. */
export interface ProxyChoice {
  value: 'http' | 'socks5';
  extra: { host: string; port: number; id?: string; secret?: string };
}

/** Small lifecycle contract available to any automation client. */
export interface ProfileEngine {
  readonly kind: string;
  readonly archiveExtension: string;
  ready(): Promise<void>;
  create(settings: Record<string, unknown>): Promise<{ id: string }>;
  install(profileId: string): Promise<void>;
  start(profileId: string): Promise<void>;
  stop(profileId: string): Promise<void>;
  export(profileId: string, file: string): Promise<void>;
  connectionUrl(profileId: string): Promise<string>;
  close(): Promise<void>;
}
