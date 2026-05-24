# System Architecture

## Overview
This application is a full-stack Next.js application leveraging the App Router. It contains both the React frontend UI and the backend API logic (Route Handlers), eliminating the need for a separate Express server.

The system relies on a dual-layer approach for data storage and coordination to guarantee correctness under concurrent load:
1. **PostgreSQL** (Source of Truth)
2. **Redis** (Coordination Layer)

### 1. PostgreSQL (Source of Truth)
We use a hosted PostgreSQL instance (Neon) connected via the Prisma ORM.
* **Responsibility**: Permanently stores Products, Warehouses, Inventory totals, and actual Reservation records.
* **Role**: It is the absolute, durable source of truth. If a reservation is confirmed, it lives here. The database enforces constraints and handles ACID transactions.

### 2. Redis (Coordination Layer)
We use a hosted serverless Redis instance (Upstash).
* **Responsibility**: Provides distributed locking, idempotency guarantees, and fast operations to coordinate incoming requests.
* **Role**: Redis does *not* permanently own inventory. It acts as a gatekeeper to serialize access to highly contended resources across distributed serverless functions.

## Why Both? (Architecture Philosophy)

A naive approach might rely solely on the database or solely on Redis. Here is why we intentionally design with both:

1. **Why not just PostgreSQL?**
   While Postgres can handle locking (e.g., `SELECT ... FOR UPDATE`), relying purely on row-level locks under extreme scale (e.g., a massive flash sale or ticket drop) can lead to severe database contention, long transaction queues, and degraded read/write performance.
2. **Why not just Redis?**
   Redis is incredibly fast, but keeping the entire inventory state perfectly synchronized in memory and durable on disk is complex. If Redis drops data or gets out of sync, we risk losing the authoritative truth for physical inventory.

### The Hybrid Solution
By combining them, we achieve both **scalability** and **correctness**.
* **Redis** absorbs the coordination overhead. It serializes incoming requests for the same `Product + Warehouse` combination through distributed locks.
* Once a request successfully holds the Redis lock, it proceeds to open a **Postgres** transaction.
* Postgres then guarantees the physical consistency and creates the durable record with a row-level lock as a secondary defense.
* This dramatically reduces database contention by ensuring only coordinated traffic reaches the database concurrently, while maintaining bulletproof data integrity.
