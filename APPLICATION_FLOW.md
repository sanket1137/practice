# PixelSpot CCMS — Application Flow

> **Last Updated:** 2026-03-17 — Payment system rewrite (Wallet → per-booking Razorpay orders)

---

## Table of Contents

1. [Authentication Flow](#1-authentication-flow)
2. [Booking Lifecycle](#2-booking-lifecycle)
3. [Payment Flow (Per-Booking Razorpay Orders)](#3-payment-flow-per-booking-razorpay-orders)
4. [Payment Status Polling](#4-payment-status-polling)
5. [Webhook Handling](#5-webhook-handling)
6. [Booking Status Update Service (Azure Function)](#6-booking-status-update-service-azure-function)
7. [Cancellation & Refund Flow](#7-cancellation--refund-flow)
8. [API Endpoints — Payments](#8-api-endpoints--payments)
9. [Database Schema — Payment Fields](#9-database-schema--payment-fields)
10. [Frontend Components — Payment](#10-frontend-components--payment)

---

## 1. Authentication Flow

- **JWT access tokens:** 15-minute expiry
- **Refresh tokens:** 7-day sliding expiry
- All protected endpoints require `[Authorize]` with valid JWT
- Resource ownership validated server-side before any CRUD operation

---

## 2. Booking Lifecycle

```
Advertiser creates booking request
         │
         ▼
    ┌─────────┐
    │ Pending  │
    └────┬────┘
         │ Screen Owner reviews
         ├──────────────────────┐
         ▼                      ▼
    ┌──────────┐          ┌──────────┐
    │ Approved │          │ Rejected │
    └────┬─────┘          └──────────┘
         │ Razorpay order created (auto)
         │ PaymentStatus = OrderCreated
         │ 24h payment window starts
         │
         ├── Payment within 24h ──────┐
         │                             ▼
         │                      ┌──────────┐
         │                      │  Active   │ (PaymentStatus = Captured)
         │                      └────┬─────┘
         │                           │ End date reached
         │                           ▼
         │                      ┌───────────┐
         │                      │ Completed  │
         │                      └───────────┘
         │
         └── No payment in 24h ──────┐
                                      ▼
                               ┌───────────┐
                               │ Cancelled  │ (PaymentStatus = Expired)
                               └───────────┘
```

### Status Transitions

| From | To | Trigger |
|------|----|---------|
| — | Pending | Advertiser submits booking request |
| Pending | Approved | Screen Owner approves (Razorpay order auto-created) |
| Pending | Rejected | Screen Owner rejects with reason |
| Approved | Active | Payment captured (via webhook or verify endpoint) |
| Approved | Cancelled | Payment expired (24h) or user cancels |
| Active | Cancelled | User cancels (refund initiated) |
| Active | Completed | End date passes (BookingStatusUpdateService) |

### Payment Status Lifecycle

| PaymentStatus | Value | Meaning |
|---------------|-------|---------|
| None | 0 | No payment activity (Pending bookings) |
| OrderCreated | 1 | Razorpay order created, awaiting payment |
| Captured | 2 | Payment successfully captured |
| RefundInitiated | 3 | Refund requested, processing |
| Refunded | 4 | Refund confirmed by Razorpay |
| Expired | 5 | 24h payment window passed |

---

## 3. Payment Flow (Per-Booking Razorpay Orders)

### Overview

Replaced the wallet-based system with **per-booking Razorpay orders**. When a Screen Owner approves a booking, a Razorpay order is automatically created with a 24-hour payment window. The Advertiser can pay via UPI QR, UPI Apps, or Bank Transfer (virtual account).

### Step-by-Step Flow

1. **Screen Owner approves booking** → `POST /bookings/{id}/approve`
   - `ApproveBookingCommandHandler` reserves slots, locks creative
   - Calls `IRazorpayService.CreateOrderAsync()` to create Razorpay order
   - Sets `booking.RazorpayOrderId`, `booking.PaymentStatus = OrderCreated`, `booking.PaymentExpiresAt = UtcNow + 24h`
   - Optionally creates Virtual Account for bank transfers via `CreateVirtualAccountAsync()` (fail-safe)
   - **Exception:** Self-reserved bookings (`BookingSource.SelfReserved`) skip payment

2. **Advertiser clicks "Pay Now"** → `POST /payments/create-order`
   - Returns existing Razorpay order details (orderId, amount, currency, keyId, virtualAccount details, expiry)
   - If order doesn't exist yet (edge case), creates one
   - Guards: booking must be Approved, not already paid, start date not passed, not expired

3. **Frontend shows PaymentScreen dialog** with 3 tabs:
   - **UPI QR:** QR code encoding `upi://pay?pa=...&am=...&cu=...`
   - **UPI Apps:** Deep links for GPay, PhonePe, Paytm, BHIM
   - **Bank Transfer:** Virtual account number + IFSC + copy-to-clipboard

4. **Payment polling starts** (every 5 seconds via `usePaymentPoller` hook)
   - `GET /payments/booking/{bookingId}/status`
   - Stops polling on `Captured`, `Refunded`, or `Expired`

5. **Payment captured** (via Razorpay webhook OR verify endpoint):
   - `booking.PaymentStatus = Captured`
   - `booking.Status = Active` (if start date checks pass)
   - Payment record updated with `RazorpayPaymentId`
   - Payout record created for Screen Owner
   - Notifications sent to both parties

---

## 4. Payment Status Polling

### Endpoint

```
GET /api/v1/payments/booking/{bookingId}/status
```

### Response DTO

```json
{
  "data": {
    "bookingId": "guid",
    "paymentStatus": "OrderCreated",
    "paymentMethod": null,
    "paymentExpiresAt": "2026-03-18T19:38:00Z",
    "razorpayOrderId": "order_xxx"
  }
}
```

### Frontend Hook: `usePaymentPoller`

- Polls every 5 seconds when `enabled = true`
- Auto-stops on terminal states (`Captured`, `Refunded`, `Expired`)
- Invalidates `['bookings']` and `['booking', bookingId]` cache on `Captured`
- Calls `onConfirmed()` callback when payment succeeds

---

## 5. Webhook Handling

### Endpoint

```
POST /api/v1/payments/webhook
```

**Authorization:** No JWT required (webhook endpoint). Validates HMAC signature from Razorpay.

### Handled Events

| Event | Handler | Action |
|-------|---------|--------|
| `payment.captured` | `HandlePaymentCaptured` | Updates Payment + Booking status to Captured, activates booking, creates payout |
| `payment.failed` | `HandlePaymentFailed` | Marks payment as Expired |
| `refund.processed` | `HandleRefundProcessed` | Updates Payment + Booking refund status |
| `virtual_account.credited` | `HandleVirtualAccountCredited` | Same as payment.captured for bank transfers |

### Webhook Security

- HMAC signature verified via `RazorpayUtils.verifyWebhookSignature()`
- Webhook secret from `Configuration["Razorpay:WebhookSecret"]`
- Raw request body read and verified before processing

---

## 6. Booking Status Update Service (Azure Function)

**Timer:** Every 15 minutes (`0 */15 * * * *`)

### Responsibilities

1. **Booking lifecycle transitions:**
   - Approved → Active (when start date arrives and payment captured)
   - Active → Completed (when end date passes)

2. **Payment expiry check:**
   - Finds bookings where `PaymentStatus == OrderCreated` AND `PaymentExpiresAt < UtcNow`
   - Sets `Status = Cancelled`, `PaymentStatus = Expired`
   - Releases slots and unlocks creative

3. **Refund status polling:**
   - Finds bookings where `PaymentStatus == RefundInitiated` AND cancelled > 1 hour ago
   - Calls `IRazorpayService.GetRefundStatusAsync()` to check Razorpay refund status
   - If refund "processed" → sets `PaymentStatus = Refunded`

---

## 7. Cancellation & Refund Flow

### Advertiser/ScreenOwner cancels a paid booking

1. `POST /bookings/{id}/cancel` → `CancelBookingCommandHandler`
2. Releases reserved slots, unlocks creative
3. If `PaymentStatus == Captured` and `RazorpayPaymentId` exists:
   - Calls `IRazorpayService.InitiateRefundAsync(paymentId, amount)`
   - Sets `booking.RazorpayRefundId`, `booking.PaymentStatus = RefundInitiated`
4. If `PaymentStatus == OrderCreated` (unpaid):
   - Sets `booking.PaymentStatus = Expired`
5. Azure Function polls refund status after 1 hour → updates to `Refunded` when confirmed

### Refund Endpoint (Admin)

```
POST /api/v1/payments/refund
```

```json
{
  "paymentId": "guid",
  "amount": 5000,
  "reason": "Customer requested"
}
```

---

## 8. API Endpoints — Payments

### Create Order

```
POST /api/v1/payments/create-order
Authorization: Bearer {token}
```

**Request:**
```json
{
  "bookingId": "guid"
}
```

**Response:**
```json
{
  "data": {
    "orderId": "order_xxx",
    "amount": 5000,
    "currency": "INR",
    "keyId": "rzp_xxx",
    "bookingId": "guid",
    "virtualAccountNumber": "1112109002363137",
    "virtualAccountIfsc": "RATN0VAAPIS",
    "paymentExpiresAt": "2026-03-18T19:38:00Z"
  }
}
```

**Validation Rules:**
- Booking must exist and belong to the authenticated user
- Booking status must be `Approved`
- Booking must not already be paid (`PaymentStatus != Captured`)
- Booking start date must not have passed
- Payment window must not have expired

### Verify Payment

```
POST /api/v1/payments/verify
Authorization: Bearer {token}
```

**Request:**
```json
{
  "razorpayOrderId": "order_xxx",
  "razorpayPaymentId": "pay_xxx",
  "razorpaySignature": "signature_string",
  "bookingId": "guid"
}
```

**Response:** `PaymentDto` with updated status

### Get Payment Status

```
GET /api/v1/payments/booking/{bookingId}/status
Authorization: Bearer {token}
```

**Response:** `BookingPaymentStatusDto`

### Get Payments by Booking

```
GET /api/v1/payments/booking/{bookingId}
Authorization: Bearer {token}
```

**Response:** Array of `PaymentDto`

### Refund Payment

```
POST /api/v1/payments/refund
Authorization: Bearer {token} (Admin)
```

**Request:**
```json
{
  "paymentId": "guid",
  "amount": 5000,
  "reason": "Customer requested"
}
```

### Webhook

```
POST /api/v1/payments/webhook
No Authorization (validates HMAC signature)
```

---

## 9. Database Schema — Payment Fields

### Booking Entity (new fields added)

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| RazorpayOrderId | string | Yes | Razorpay order ID (set on approval) |
| RazorpayPaymentId | string | Yes | Razorpay payment ID (set on capture) |
| RazorpayRefundId | string | Yes | Razorpay refund ID (set on refund initiation) |
| PaymentMethod | string | Yes | "UPI" or "BankTransfer" |
| PaymentExpiresAt | DateTime | Yes | 24h after order creation |
| VirtualAccountNumber | string | Yes | Bank transfer virtual account number |
| VirtualAccountIfsc | string | Yes | Bank transfer IFSC code |
| PaymentStatus | enum | No | None/OrderCreated/Captured/RefundInitiated/Refunded/Expired |

### Migration

```
20260316193832_AddBookingPaymentFields.cs
```

### PaymentStatus Enum

```csharp
public enum PaymentStatus
{
    None = 0,
    OrderCreated = 1,
    Captured = 2,
    RefundInitiated = 3,
    Refunded = 4,
    Expired = 5
}
```

---

## 10. Frontend Components — Payment

### PaymentScreen (`components/bookings/PaymentScreen.tsx`)

Full-screen dialog with 3 MUI Tabs:

1. **UPI QR Tab:** QR code (via `qrcode.react`) encoding UPI payment string
2. **UPI Apps Tab:** Deep link buttons for GPay, PhonePe, Paytm, BHIM
3. **Bank Transfer Tab:** Virtual account number + IFSC with copy-to-clipboard

Features:
- Countdown timer showing time until `paymentExpiresAt`
- Success state with checkmark when `isCaptured` (from `usePaymentPoller`)
- Auto-closes dialog on successful payment

### usePaymentPoller (`hooks/usePaymentPoller.ts`)

Custom hook using TanStack React Query `refetchInterval`:
- Polls `GET /payments/booking/{bookingId}/status` every 5 seconds
- Stops polling on terminal states
- Invalidates bookings query cache on capture
- Returns `{ paymentStatus, paymentMethod, isLoading, isCaptured }`

### StatusChip Updates

- Added `PaymentPending` to `BookingStatus` type
- Pulsing amber animation for "Awaiting Payment" chip
- Shows countdown timer ("Expires in Xh Ym") in booking table

### BookingsPage Updates

- "Pay Now" button opens PaymentScreen dialog (replacing old Razorpay popup checkout)
- Amber "Pay Now" button when `paymentStatus === 'OrderCreated'`
- Status column shows "Awaiting Payment" chip with countdown for payment-pending bookings

### BookingDetailPage Updates

- Payment callout Alert at top when payment pending (amber warning with "Pay Now" button)
- Shows amount + countdown to expiry
