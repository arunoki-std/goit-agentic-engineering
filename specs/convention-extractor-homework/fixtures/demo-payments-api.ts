/**
 * DEMO FIXTURE — payments API response handler.
 *
 * This file exists ONLY to demonstrate the API Contract Reviewer skill.
 * It intentionally introduces a breaking change so the demo agent review
 * can show the before/after behaviour (without skill vs with skill).
 *
 * --- PUBLIC CONTRACT (before this PR) ---
 *
 * GET /api/payments/:id  → 200 OK
 * {
 *   "transaction_id": "txn_abc123",
 *   "amount": 4999,
 *   "account_number": "****4242",
 *   "currency": "USD",
 *   "created_at": "2024-01-15T10:30:00Z",
 *   "status": "settled"
 * }
 *
 * --- BREAKING CHANGE IN THIS FILE ---
 *
 * 1. `transaction_id`  renamed → `transactionId`   (snake_case → camelCase, no alias)
 * 2. `account_number`  REMOVED  (field deleted without deprecation notice)
 * 3. `created_at`      renamed → `createdAt`        (snake_case → camelCase, no alias)
 * 4. HTTP status on create changed 201 → 200         (status code change)
 *
 * Clients using the snake_case field names will receive `undefined` for every
 * renamed key.  Clients that rely on `account_number` will break silently.
 */

export interface PaymentResponse {
  // BREAKING: was `transaction_id` (snake_case) — clients using old name get undefined
  transactionId: string;
  amount: number;
  // BREAKING: `account_number` removed — no deprecation, no migration period
  currency: string;
  // BREAKING: was `created_at` (snake_case) — clients using old name get undefined
  createdAt: string;
  status: 'pending' | 'settled' | 'failed';
}

export function formatPaymentResponse(row: {
  id: string;
  amount: number;
  account_number: string;
  currency: string;
  created_at: Date;
  status: string;
}): PaymentResponse {
  return {
    // BREAKING: was `transaction_id: row.id`
    transactionId: row.id,
    amount: row.amount,
    // account_number omitted — BREAKING removal
    currency: row.currency,
    // BREAKING: was `created_at: row.created_at.toISOString()`
    createdAt: row.created_at.toISOString(),
    status: row.status as PaymentResponse['status'],
  };
}

// BREAKING: POST /api/payments used to return 201 Created; now returns 200 OK
export const CREATE_PAYMENT_STATUS = 200; // was: 201
