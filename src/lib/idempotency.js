import { redis } from "./redis.js";
import crypto from "crypto";
import { NextResponse } from "next/server";

export async function withIdempotency(req, handler) {
  const idempotencyKey = req.headers.get("idempotency-key");
  
  if (!idempotencyKey) {
    // If client does not send an idempotency key, skip protection and execute normally
    return await handler();
  }

  const redisKey = `idem:${idempotencyKey}`;
  
  // Fingerprint the request payload to prevent malicious/accidental reuse of the same key for different actions
  const reqClone = req.clone();
  let payloadText = "";
  try {
    payloadText = await reqClone.text();
  } catch (e) {}

  const payloadHash = crypto.createHash("sha256").update(payloadText).digest("hex");

  // 1. Check if we already processed this request
  const existing = await redis.get(redisKey);
  if (existing) {
    // Prevent collision / reuse with a mismatched payload
    if (existing.payloadHash !== payloadHash) {
      return NextResponse.json(
        { error: "Idempotency key mismatch. You cannot reuse the same key for a different request payload." },
        { status: 400 }
      );
    }
    // Safely return the identical cached response without touching the database
    return NextResponse.json(existing.body, { status: existing.status });
  }

  // 2. Prevent concurrent identical requests from slamming the handler simultaneously
  const lockKey = `idem:lock:${idempotencyKey}`;
  const lockAcquired = await redis.set(lockKey, "LOCKED", { nx: true, ex: 30 });
  
  if (!lockAcquired) {
    return NextResponse.json(
      { error: "A request with this Idempotency-Key is currently processing. Please wait." },
      { status: 409 }
    );
  }

  try {
    // 3. Execute the actual route logic
    const response = await handler();
    
    // 4. Extract the response payload to cache it
    const resClone = response.clone();
    let resBody = null;
    try {
      resBody = await resClone.json();
    } catch (e) {
      resBody = await resClone.text();
    }
    
    // 5. Store the result in Redis with a 15-minute TTL
    await redis.set(redisKey, {
      payloadHash,
      status: response.status,
      body: resBody
    }, { ex: 15 * 60 });
    
    return response;
  } finally {
    // 6. Release the execution lock
    await redis.del(lockKey);
  }
}
