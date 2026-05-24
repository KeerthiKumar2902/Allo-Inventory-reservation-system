# Reservation Lifecycle and Flow

## The Lifecycle of a Reservation
A reservation transitions through three distinct phases:
1. **Pending**: A temporary hold on inventory during checkout. It has a specific expiry time.
2. **Confirmed**: The user completed the payment successfully. The temporary hold becomes a permanent deduction of physical stock.
3. **Released**: The payment failed, was cancelled by the user, or the reservation TTL expired. The temporary hold is removed, and stock is returned to the available pool.

## High-Level Reserve Flow
When a `POST /reservations` request hits the backend, it must navigate the concurrency protections. The flow is strictly defined as follows:

1. **Acquire Redis Lock**: The system attempts to acquire a distributed lock keyed by `product_id` and `warehouse_id`. If it cannot acquire the lock, the request fails. This strictly serializes access to specific inventory pools.
2. **Open DB Transaction**: Once the lock is held, a PostgreSQL transaction begins.
3. **Lock Inventory Row**: Inside the transaction, we explicitly lock the specific inventory row (e.g., using a Prisma-level `FOR UPDATE` equivalent if available, or relying on serialized transaction isolation) to ensure no other database process can mutate it.
4. **Validate Stock**: We calculate available stock (`totalStock - reservedStock`). If `requestedQuantity > availableStock`, we immediately rollback the transaction, release the Redis lock, and return a `409 Conflict`.
5. **Create Reservation**: We insert a new record into the `Reservation` table with status `PENDING` and a calculated expiry timestamp.
6. **Update Inventory**: We increment the `reservedStock` column on the relevant inventory row.
7. **Commit Transaction**: The database transaction is durably committed.
8. **Release Redis Lock**: The distributed lock is released, allowing the next queued request to process.

## High-Level Confirm / Release Flow
Confirming (`POST /reservations/:id/confirm`) or Releasing (`POST /reservations/:id/release`) follows a similar protective strategy:
1. Acquire Redis Lock (to prevent simultaneous confirm and release of the same reservation/inventory).
2. Open DB Transaction.
3. Verify the reservation is currently `PENDING`. If not, abort (already processed).
4. Mutate the reservation status to `CONFIRMED` or `RELEASED`.
5. Adjust the inventory correctly (for confirm: permanent deduction from totalStock and reservedStock; for release: decrement reservedStock only).
6. Commit Transaction and Release Lock.

## Expiry Management
Since reservations have a Time-To-Live (TTL), they must auto-release if the user abandons checkout.
Because Postgres is the source of truth, we will rely on a scheduled process (e.g., a cron job or scheduled serverless function) to periodically query the database for expired, pending reservations. The cron job will then execute the Release flow for these stale reservations. This guarantees robust consistency without relying solely on volatile Redis TTLs.
