// Saxlama abstraksiyası: Netlify-da @netlify/blobs, lokalda fayl sistemi.
// Layihələr, parse nəticələri və orijinal fayllar burada saxlanılır.

export interface StoredFileMeta {
  contentType?: string;
  [key: string]: unknown;
}

export interface Storage {
  getJSON<T>(key: string): Promise<T | null>;
  setJSON(key: string, value: unknown): Promise<void>;
  putFile(key: string, data: ArrayBuffer | Buffer, meta?: StoredFileMeta): Promise<void>;
  getFile(key: string): Promise<{ data: Buffer; meta: StoredFileMeta } | null>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}

/* ----------------------- Netlify Blobs ----------------------- */

class NetlifyBlobsStorage implements Storage {
  private storePromise: Promise<any> | null = null;

  private async store() {
    if (!this.storePromise) {
      this.storePromise = import("@netlify/blobs").then((m) =>
        m.getStore({ name: "list-checker", consistency: "strong" }),
      );
    }
    return this.storePromise;
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const store = await this.store();
    return ((await store.get(key, { type: "json" })) as T) ?? null;
  }

  async setJSON(key: string, value: unknown): Promise<void> {
    const store = await this.store();
    await store.setJSON(key, value);
  }

  async putFile(key: string, data: ArrayBuffer | Buffer, meta?: StoredFileMeta): Promise<void> {
    const store = await this.store();
    const body = Buffer.isBuffer(data) ? data : Buffer.from(new Uint8Array(data));
    await store.set(key, body, { metadata: meta ?? {} });
  }

  async getFile(key: string): Promise<{ data: Buffer; meta: StoredFileMeta } | null> {
    const store = await this.store();
    const res = await store.getWithMetadata(key, { type: "arrayBuffer" });
    if (!res) return null;
    return { data: Buffer.from(res.data as ArrayBuffer), meta: (res.metadata as StoredFileMeta) ?? {} };
  }

  async delete(key: string): Promise<void> {
    const store = await this.store();
    await store.delete(key);
  }

  async deletePrefix(prefix: string): Promise<void> {
    const store = await this.store();
    const { blobs } = await store.list({ prefix });
    await Promise.all((blobs as Array<{ key: string }>).map((b) => store.delete(b.key)));
  }
}

/* ----------------------- Fayl sistemi (lokal dev) ----------------------- */

class FsStorage implements Storage {
  private root = ".data";

  private async fs() {
    return import("node:fs/promises");
  }
  private async pathmod() {
    return import("node:path");
  }

  private async resolve(key: string): Promise<string> {
    const path = await this.pathmod();
    return path.join(process.cwd(), this.root, key);
  }

  private async ensureDir(filePath: string): Promise<void> {
    const fs = await this.fs();
    const path = await this.pathmod();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const fs = await this.fs();
    try {
      const raw = await fs.readFile(await this.resolve(`${key}.json`), "utf8");
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJSON(key: string, value: unknown): Promise<void> {
    const fs = await this.fs();
    const p = await this.resolve(`${key}.json`);
    await this.ensureDir(p);
    await fs.writeFile(p, JSON.stringify(value), "utf8");
  }

  async putFile(key: string, data: ArrayBuffer | Buffer, meta?: StoredFileMeta): Promise<void> {
    const fs = await this.fs();
    const p = await this.resolve(key);
    await this.ensureDir(p);
    const body = Buffer.isBuffer(data) ? data : Buffer.from(new Uint8Array(data));
    await fs.writeFile(p, body);
    await fs.writeFile(`${p}.meta.json`, JSON.stringify(meta ?? {}), "utf8");
  }

  async getFile(key: string): Promise<{ data: Buffer; meta: StoredFileMeta } | null> {
    const fs = await this.fs();
    try {
      const p = await this.resolve(key);
      const data = await fs.readFile(p);
      let meta: StoredFileMeta = {};
      try {
        meta = JSON.parse(await fs.readFile(`${p}.meta.json`, "utf8"));
      } catch {
        /* meta yox */
      }
      return { data, meta };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const fs = await this.fs();
    try {
      await fs.rm(await this.resolve(`${key}.json`), { force: true });
      await fs.rm(await this.resolve(key), { force: true });
      await fs.rm(await this.resolve(`${key}.meta.json`), { force: true });
    } catch {
      /* ignore */
    }
  }

  async deletePrefix(prefix: string): Promise<void> {
    const fs = await this.fs();
    try {
      await fs.rm(await this.resolve(prefix), { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

let cached: Storage | null = null;

/** Mühitə görə uyğun saxlama provayderini qaytarır. */
export function getStorage(): Storage {
  if (cached) return cached;
  // Netlify mühitində Blobs; əks halda lokal fayl sistemi.
  const onNetlify = !!(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT);
  cached = onNetlify ? new NetlifyBlobsStorage() : new FsStorage();
  return cached;
}
