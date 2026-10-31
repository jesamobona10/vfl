import { redis, hasRedis } from "./redis";

type CacheOptions = {
  ttl?: number;
  tags?: string[];
};

const memory = new Map<string, { value: any; expiresAt: number; tags: string[] }>();
const tagToKeys = new Map<string, Set<string>>();

function setTag(key: string, tags: string[]) {
  for (const tag of tags) {
    if (!tagToKeys.has(tag)) tagToKeys.set(tag, new Set());
    tagToKeys.get(tag)!.add(key);
  }
}

function deleteByTag(tag: string) {
  const keys = tagToKeys.get(tag);
  if (!keys) return;
  for (const key of keys) {
    memory.delete(key);
    if (hasRedis && redis) {
      redis.del(key).catch(() => {});
    }
  }
  tagToKeys.delete(tag);
}

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: CacheOptions = {}
): Promise<T> {
  const ttl = opts.ttl ?? 300;
  const tags = opts.tags ?? [];

  if (hasRedis && redis) {
    try {
      const cached = await redis.get<T>(key);
      if (cached !== null && cached !== undefined) {
        return cached;
      }
    } catch {
      // fall through to fetch
    }
  }

  const mem = memory.get(key);
  if (mem && mem.expiresAt > Date.now()) {
    return mem.value as T;
  }

  const value = await fetcher();
  const expiresAt = Date.now() + ttl * 1000;

  if (hasRedis && redis) {
    try {
      await redis.set(key, value, { ex: ttl });
    } catch {
      // ignore
    }
  }

  memory.set(key, { value, expiresAt, tags });
  if (tags.length) setTag(key, tags);

  return value;
}

export async function invalidateTag(tag: string): Promise<void> {
  deleteByTag(tag);
}

export async function invalidateTags(tags: string[]): Promise<void> {
  for (const tag of tags) {
    await invalidateTag(tag);
  }
}

export async function invalidateKey(key: string): Promise<void> {
  memory.delete(key);
  if (hasRedis && redis) {
    try {
      await redis.del(key);
    } catch {}
  }
}
