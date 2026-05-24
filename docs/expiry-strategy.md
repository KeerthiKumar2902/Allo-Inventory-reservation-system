# Reservation Expiry Strategy

## Overview
Reservations must automatically release inventory if a user abandons their checkout or a payment fails. Without this cleanup, physical stock would be permanently deadlocked by abandoned carts.

## Automated Cron Architecture
We utilize a Vercel Cron Job scheduled to run automatically (e.g., every 5 minutes).
* **Endpoint**: `GET /api/cron/expire-reservations`
* **Security**: Protected by a `CRON_SECRET` environment variable ensuring only authorized Vercel schedulers can trigger it, preventing malicious manual triggers.

## Why Cron instead of pure Redis TTL?
While Redis allows key expiration (TTL) events, relying *solely* on Redis TTLs to permanently adjust our source of truth (PostgreSQL) is fundamentally risky. If the Redis event is dropped, or the Next.js server crashes while processing it, our database becomes permanently out of sync and inventory is lost. 

By having a cron job query the **database** directly for `expiresAt < now`, PostgreSQL remains the unbreakable source of truth.

## Transaction Handling
When the cron runs:
1. It queries all `PENDING` reservations where `expiresAt` is in the past.
2. It loops through them, opening an individual **ACID Transaction** for each reservation.
3. It uses `SELECT ... FOR UPDATE` to lock the reservation and inventory rows safely (identical to the manual release endpoint).
4. It safely decrements `reservedStock` and marks the reservation as `RELEASED`.

### Lifecycle Safety & Resilience
* **No partial failures**: If one reservation fails to release due to a momentary deadlock or DB stutter, the others still succeed. The failed one will simply be picked up on the next cron cycle.
* **Idempotency**: If the cron is accidentally triggered twice simultaneously, or if the user clicks "cancel" right as the cron runs, the row-level `FOR UPDATE` lock ensures a reservation is strictly evaluated once. If it's already transitioned out of `PENDING`, the transaction exits gracefully.
