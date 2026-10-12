import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function durableWrite(
  file: string,
  contents: string | Buffer,
): Promise<void> {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(contents);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, file);
  if (process.platform !== "win32") {
    const directory = await open(dirname(file), "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }
}

export class InputVault {
  private key!: Buffer;
  constructor(private directory: string) {}
  async init() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const file = join(this.directory, "vault-key");
    try {
      this.key = await readFile(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const key = randomBytes(32);
      const handle = await open(file, "wx", 0o600);
      try {
        await handle.writeFile(key);
        await handle.sync();
      } finally {
        await handle.close();
      }
      this.key = key;
    }
    if (this.key.length !== 32)
      throw new Error("Input vault key must contain 32 bytes");
  }
  private file(id: string) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid vault reference");
    return join(this.directory, `${id}.sealed`);
  }
  async put(id: string, value: unknown) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(id));
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    await durableWrite(
      this.file(id),
      Buffer.concat([iv, cipher.getAuthTag(), encrypted]),
    );
  }
  async get<T>(id: string): Promise<T> {
    const data = await readFile(this.file(id));
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      data.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(id));
    decipher.setAuthTag(data.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([
        decipher.update(data.subarray(28)),
        decipher.final(),
      ]).toString("utf8"),
    ) as T;
  }
  async delete(id: string) {
    await rm(this.file(id), { force: true });
  }
}
