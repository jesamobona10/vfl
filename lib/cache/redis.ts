import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const hasRedis = Boolean(url && token);

export const redis: Redis | null = hasRedis
  ? new Redis({
      url: url!,
      token: token!,
    })
  : null;
