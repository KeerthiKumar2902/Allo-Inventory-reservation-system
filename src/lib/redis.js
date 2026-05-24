import { Redis } from '@upstash/redis'
import { env } from './env.js'

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
})

export async function acquireLock(key, expirationSeconds = 10) {
  const result = await redis.set(key, "LOCKED", { nx: true, ex: expirationSeconds });
  return result === "OK";
}

export async function releaseLock(key) {
  await redis.del(key);
}
