# Allo Inventory | Concurrency-Safe System

**Author:** Keerthi Kumar S, 22MIS0080

## 1. Project Overview

I built this high-performance, concurrency-safe inventory reservation system. My primary goal was to solve the critical e-commerce problem of **"overselling."** I designed the system to ensure that when multiple users attempt to reserve the exact same limited supplies simultaneously, my architecture enforces strict mathematical correctness and never allows the stock to drop below zero.

### Important Links
- **Live Deployment:** [https://allo-inventory-reservation-system-red.vercel.app](https://allo-inventory-reservation-system-red.vercel.app)
- **GitHub Repository:** [https://github.com/KeerthiKumar2902/Allo-Inventory-reservation-system](https://github.com/KeerthiKumar2902/Allo-Inventory-reservation-system)

## 2. Architecture

At a high level, I designed a **Dual-Database Coordination Architecture**:

- **Frontend:** Next.js 15 (App Router) + Tailwind CSS + Shadcn UI.
- **Database (Source of Truth):** I utilized PostgreSQL (via Neon) to handle ACID-compliant relational data, storing the definitive state of the inventory and reservations.
- **Coordination (Locking & Caching):** I integrated Upstash Redis as a high-speed distributed coordination layer. It handles my distributed mutex locks to prevent race conditions and caches idempotency keys.

### System Data Flow

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant Vercel API
    participant Upstash Redis
    participant Neon Postgres
    participant Vercel Cron

    User->>Frontend: Click "Reserve"
    Frontend->>Vercel API: POST /api/reservations (Idempotency-Key)
    
    Vercel API->>Upstash Redis: Check Idempotency Key
    Upstash Redis-->>Vercel API: Not found
    
    Vercel API->>Neon Postgres: Atomic update (reservedStock += 1)
    Neon Postgres-->>Vercel API: Success
    
    Vercel API->>Neon Postgres: Create pending reservation (Expires in 10m)
    Vercel API->>Upstash Redis: Set Idempotency Key
    Vercel API-->>Frontend: Reservation OK
    Frontend-->>User: Show Checkout with Countdown

    opt Payment Succeeds
        User->>Frontend: Click "Pay Now"
        Frontend->>Vercel API: POST /api/reservations/:id/confirm
        Vercel API->>Neon Postgres: Update reservation status to 'CONFIRMED'
        Vercel API->>Neon Postgres: Update totalStock -= 1, reservedStock -= 1
    end

    opt Expiry (No Payment)
        Vercel Cron->>Vercel API: GET /api/cron/expire-reservations
        Vercel API->>Neon Postgres: Find expired PENDING reservations
        Vercel API->>Neon Postgres: Mark 'RELEASED' & reservedStock -= 1
    end
```

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
   Push my schema to your database and seed it with the medical inventory:
   ```bash
   npx prisma db push
   node prisma/seed.js
   ```
5. **Run the Application:**
   ```bash
   npm run dev
   ```

## 4. Database & Schema Design

I designed the core schema around a strict separation of concerns for inventory mathematics:

- **`Product` & `Warehouse`**: These are my core domain models defining what exists and where it is located.
- **`Inventory`**: Instead of relying on a simple `stock` integer, my schema tracks `totalStock` and `reservedStock`. I dynamically derive `availableStock` (`total - reserved`). This architecture ensures I always know exactly how much inventory physically exists in the warehouse versus how much is temporarily locked in users' carts.
- **`Reservation`**: This table tracks the lifecycle of a user's checkout session. I implemented support for `PENDING`, `CONFIRMED`, and `RELEASED` states, along with an `expiresAt` timestamp for automatic cleanup.

## 5. Concurrency Strategy

Handling concurrent requests was the most critical engineering challenge I tackled in this system. I recognized that a naive approach (checking stock in memory and then updating the database) fails catastrophically under load. It leads to race conditions where multiple users might successfully reserve the last remaining item.

**My Solution:**

1. **Redis Mutex Locking**: Before my API even touches the PostgreSQL database, it acquires a distributed lock in Redis (`lock:inventory:{productId}:{warehouseId}`). If 10 requests hit my server at the exact same millisecond, Redis serialization ensures only 1 request secures the lock. The other 9 instantly receive a `409 Conflict`.
2. **PostgreSQL `FOR UPDATE`**: Inside the Prisma transaction, my system executes a raw SQL `SELECT ... FOR UPDATE`. This intentionally invokes row-level database locking. Even if the Redis lock is hypothetically bypassed, Postgres fundamentally prevents any other transaction from reading or modifying that specific inventory row until my current transaction securely commits.
3. **Atomic Math**: I utilized atomic increments and decrements (`increment: quantity`) rather than reading a value into memory and saving it back, ensuring absolute mathematical precision.

## 6. Expiry Strategy

I configured reservations to only be valid for 10 minutes.

- **The Problem:** I could not rely on the client's browser to tell my server when a reservation expires, because the user might simply close their tab.
- **My Solution:** I engineered a serverless Cron Job endpoint (`GET /api/cron/expire-reservations`) to automatically scrub abandoned carts from the database. Because Vercel's free "Hobby" tier restricts internal cron jobs to running only once a day, I cleverly bypassed this limitation by using an external ping service (**cron-job.org**) to securely trigger the endpoint every 5 minutes.
- **Security:** I protected the cron route from public abuse by enforcing a strict `CRON_SECRET` Bearer authorization header, which the external cron service passes securely.
- **Tradeoffs Considered:** A polling cron job means an abandoned reservation might technically be held for up to 14 minutes (if it expires right after the 5-minute cron cycle finishes). I am aware that a more complex, enterprise-grade architecture would use a Queue Worker (like AWS SQS or Redis BullMQ) to schedule an exact delayed job. However, given serverless constraints and the requirement for a free-tier deployment, my external Cron approach proved to be the most pragmatic and highly stable solution.

## 7. Idempotency Implementation

To make my APIs truly production-ready and resilient, I implemented **Idempotency** for the Reserve and Confirm routes.

- **Why it matters:** If a user is on a train with a flaky 4G connection, their phone might automatically retry the `POST /confirm` request multiple times. Without idempotency, my backend could accidentally deduct the stock multiple times.
- **My Strategy:** I designed the frontend to generate a `crypto.randomUUID()` and send it within the `Idempotency-Key` HTTP header. My backend middleware intercepts this, hashes the request payload, and checks my Redis cache. If I have seen this exact key before, I instantly return the cached `200 OK` response without executing any redundant database logic. This state safely resides in Redis for 15 minutes.

## 8. Future Improvements

- **Lock Retry Mechanism:** While the current Redis lock fails fast and returns a 409 error if a product is being modified, adding a short retry mechanism (spin-lock) could improve the user experience by waiting a few milliseconds before failing.
- **Event-Driven Expiry:** Replacing the polling cron job with an event-driven architecture (like Redis BullMQ or RabbitMQ) would allow reservations to expire precisely at the 10-minute mark rather than waiting for the next cron interval.
- **User Authentication:** The current system uses `localStorage` for cart persistence. A future iteration would integrate NextAuth.js or Clerk to tie reservations to authenticated user accounts instead of browser sessions.
- **Observability:** Adding tools like Datadog or Sentry would help track `409 Conflict` rates to better understand peak concurrency traffic and user behavior.

---
> [!NOTE]  
> **Check out the docs for a more detailed understanding of the system's architecture and design patterns.**
