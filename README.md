# Allo Pharmacy | Concurrency-Safe Inventory System

## 1. Project Overview
This project is a high-performance, concurrency-safe medical inventory reservation system built for Allo Health. It solves the critical e-commerce problem of **"overselling"**—ensuring that when multiple clinics or users attempt to reserve the exact same limited medical supplies simultaneously, the system enforces strict mathematical correctness and never drops below zero stock. 

## 2. Architecture
At a high level, the system utilizes a **Dual-Database Coordination Architecture**:
* **Frontend:** Next.js 15 (App Router) + Tailwind CSS + Shadcn UI.
* **Database (Truth):** PostgreSQL (via Neon) handles the ACID-compliant relational data, storing the definitive state of inventory and reservations.
* **Coordination (Locking & Caching):** Upstash Redis acts as a high-speed distributed coordination layer, handling distributed mutex locks to prevent race conditions and caching idempotency keys.

## 3. Setup Instructions
### Prerequisites
- Node.js 18+
- A PostgreSQL database (e.g., Neon)
- A Redis instance (e.g., Upstash)

### Local Setup
1. **Clone the repository:**
   ```bash
   git clone https://github.com/KeerthiKumar2902/Allo-Inventory-reservation-system.git
   cd Allo-Inventory-reservation-system
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Environment Variables:**
   Copy the `.env.example` file to `.env` and fill in your database credentials:
   ```bash
   cp .env.example .env
   ```
4. **Database Migration & Seeding:**
   Push the schema to your database and seed it with the medical inventory:
   ```bash
   npx prisma db push
   node prisma/seed.js
   ```
5. **Run the Application:**
   ```bash
   npm run dev
   ```

## 4. Database + Schema Notes
The core schema is designed around separation of concerns for inventory math:
* **`Product` & `Warehouse`**: Core domain models defining what exists and where.
* **`Inventory`**: Instead of a simple `stock` integer, it tracks `totalStock` and `reservedStock`. `availableStock` is dynamically derived (`total - reserved`). This ensures we always know exactly how much inventory physically exists in the warehouse versus how much is locked in people's carts.
* **`Reservation`**: Tracks the lifecycle of a user's checkout session. It supports `PENDING`, `CONFIRMED`, and `RELEASED` states, along with an `expiresAt` timestamp.

## 5. Concurrency Strategy
This is the most critical engineering challenge of the system. A naive approach (checking stock in JavaScript and then updating the database) fails catastrophically under load, leading to race conditions where 3 users might successfully reserve the last 1 remaining item.

**The Solution:**
1. **Redis Mutex Locking**: Before the database is even touched, the API acquires a distributed lock in Redis (`lock:inventory:{productId}:{warehouseId}`). If 10 requests hit the server at the exact same millisecond, Redis serialization ensures only 1 gets the lock, and the other 9 receive a fast `409 Conflict` or wait in line.
2. **Postgres `FOR UPDATE`**: Inside the Prisma transaction, the system runs a raw SQL `SELECT ... FOR UPDATE`. This invokes row-level database locking. Even if the Redis lock is somehow bypassed or expires early, Postgres fundamentally prevents any other transaction from reading or modifying that specific inventory row until the current transaction commits. 
3. **Atomic Math**: The system uses atomic increments/decrements (`increment: quantity`) rather than reading a value into memory and saving it back.

## 6. Expiry Strategy
Reservations are only valid for 10 minutes. 
* **The Problem:** We cannot rely on the client browser to tell us a reservation expired, because the user might close the tab.
* **The Solution:** We implemented a serverless Cron Job (`GET /api/cron/expire-reservations`) configured in `vercel.json` to run every 5 minutes.
* **Security:** The cron route is protected by a `CRON_SECRET` authorization header.
* **Tradeoffs:** A polling cron job means a reservation might technically be held for up to 14 minutes (if it expires right after the 5-minute cron cycle finishes). A better, but infinitely more complex, architecture would be using a Queue Worker (like AWS SQS or Redis BullMQ) to schedule an exact delayed job. Given Vercel's serverless constraints, the Cron approach is the most pragmatic and stable.

## 7. Idempotency
To make the APIs truly production-ready, we implemented **Idempotency** for the Reserve and Confirm routes.
* **Why it matters:** If a user is on a train with a flaky 4G connection, their phone might retry the `POST /confirm` request 3 times. Without idempotency, this could lead to deducting stock 3 times.
* **The Strategy:** The frontend generates a `crypto.randomUUID()` and sends it in the `Idempotency-Key` header. The backend intercepts this, hashes the request payload, and checks Redis. If it has seen this key before, it intercepts the request and instantly returns the cached `200 OK` response without executing any database logic. The state is cached in Redis for 15 minutes.

## 8. Tradeoffs + Future Improvements
* **Redis Locking Scope:** Currently, the Redis lock locks the specific product at a specific warehouse. This is highly performant. However, we could improve the spin-lock mechanism to retry for a few seconds before failing, rather than instantly returning a 409.
* **Queue Workers vs. Cron:** As mentioned in the Expiry Strategy, a real enterprise system would use an event-driven architecture (Kafka, RabbitMQ) to handle expirations down to the exact millisecond, rather than a polling cron job.
* **Authentication:** This demo uses `localStorage` for cart persistence. A real application would require NextAuth.js or Clerk to tie reservations to a rigid `UserId` schema.
* **Monitoring:** Adding Datadog or Sentry would be the next step to monitor 409 Conflict rates to understand how often users are fighting over the same inventory.
