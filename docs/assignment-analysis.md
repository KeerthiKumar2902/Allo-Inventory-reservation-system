# Assignment Analysis: Inventory Reservation System

## Business Problem
In e-commerce, payment processing often introduces latency. Scenarios such as UPI confirmations, 3D Secure verification, and wallet redirects can take anywhere from a few seconds to several minutes to resolve. During this window, a naive inventory system faces significant challenges:

1. **Overselling**: If stock is decremented *only after* a successful payment, multiple users may initiate checkout for the same physical item simultaneously. They could all successfully pay for the same item, forcing the business into costly refunds, manual support intervention, and damaging customer trust.
2. **Abandoned Cart Locking (Under-utilization)**: If stock is decremented *too early* (e.g., as soon as an item is added to a cart), abandoned carts tie up inventory indefinitely. This makes items appear out-of-stock to motivated buyers, severely impacting conversion rates.

## Solution: Reservation-Based Inventory
To bridge the gap between intent-to-buy and successful payment, we implement a reservation model.
When a user begins checkout:
* Inventory is temporarily reserved for a specific duration (e.g., 15 minutes).
* If payment succeeds: The reservation is permanently confirmed, and the overall physical stock is officially decremented.
* If payment fails or time expires: The reservation is automatically released, freeing the stock for other users.

## Core Concurrency Problem
Correctness under high concurrency is the absolute most critical requirement of this system.

**Example Scenario:**
- Only **1** stock unit remains for "Product A" in "Warehouse 1".
- **3** users attempt to reserve it simultaneously (exact same millisecond).

**Expected Behavior:**
- Exactly one user's reservation request must succeed.
- The other two users must receive a failure response (e.g., `409 Conflict: Insufficient stock`).
- The system must mathematically guarantee that reserved stock never exceeds total available stock, preventing negative inventory.
- No race conditions can occur during the check-and-update process.
