# Payment Fee System Implementation

This document describes the enhanced payment flow with transaction fees and balance management implemented in the CoPay backend system.

## Overview

The payment system now includes:

- **Fixed transaction fee**: 500 RWF on every payment
- **Balance redistribution**: Automatic fund allocation after payment settlement
- **Admin dashboard**: Balance tracking and statistics for administrators

## Payment Flow

### 1. Payment Initiation

```
User initiates payment: 50,000 RWF
↓
System calculates:
- Base Amount: 50,000 RWF
- Fee: 500 RWF  
- Total Paid: 50,500 RWF
↓
IremboPay invoice created for: 50,500 RWF
```

### 2. Payment Processing

```
User pays via IremboPay: 50,500 RWF
↓
Money goes to ONE CoPay account
↓
Webhook confirms payment completion
↓
System redistributes internally:
- Cooperative balance += 50,000 RWF (base amount)
- CoPay profit += 500 RWF (transaction fee)
```

## Database Schema Changes

### Enhanced Payment Model

```prisma
model Payment {
  // Enhanced fee structure
  baseAmount  Float         // Original payment amount before fees
  fee         Float         @default(500) // Transaction fee (500 RWF fixed)
  amount      Float         // Total amount (baseAmount + fee) - for backward compatibility
  totalPaid   Float         // Total amount paid (baseAmount + fee)
  
  // Balance tracking flags
  cooperativeBalanceUpdated Boolean @default(false)
  feeBalanceUpdated         Boolean @default(false)
  
  // ... other existing fields
}
```

### New Balance Models

```prisma
model CooperativeBalance {
  cooperativeId    String @unique @db.ObjectId
  currentBalance   Float @default(0)
  totalReceived    Float @default(0)
  totalWithdrawn   Float @default(0)
  pendingBalance   Float @default(0)
  // ... other fields
}

model CopayBalance {
  currentBalance      Float @default(0) // Current fee profit balance
  totalFees          Float @default(0) // Total fees collected
  totalTransactions  Int   @default(0) // Total number of fee transactions
  // ... other fields
}

model BalanceTransaction {
  type   BalanceTransactionType // CREDIT_FROM_PAYMENT, FEE_COLLECTION, etc.
  amount Float
  status BalanceTransactionStatus
  // ... other fields
}
```

## API Changes

### Enhanced Payment Response

```json
{
  "id": "507f1f77bcf86cd799439011",
  "baseAmount": 50000,
  "fee": 500,
  "amount": 50500,
  "totalPaid": 50500,
  "status": "PENDING",
  "paymentType": { /* ... */ },
  "sender": { /* ... */ },
  "cooperative": { /* ... */ }
}
```

### New Balance Endpoints

#### 1. Global Balance Overview (Super Admin)

```
GET /balances/overview
```

Returns comprehensive statistics for admin dashboard.

#### 2. Cooperative Balance Details

```
GET /balances/cooperative/:cooperativeId
```

Returns balance information for a specific cooperative.

#### 3. CoPay Profit Balance (Super Admin)

```
GET /balances/copay
```

Returns fee collection statistics and profit information.

#### 4. Payment Calculator

```
GET /balances/calculate?amount=50000
```

Returns:

```json
{
  "baseAmount": 50000,
  "fee": 500,
  "totalPaid": 50500
}
```

## Implementation Details

### MongoDB Transaction Limitations

**Important Note**: This implementation is designed to work with MongoDB deployments that don't support transactions (such as shared clusters). Instead of atomic transactions, the system uses sequential processing with error handling.

### Sequential Balance Processing

```typescript
// Instead of $transaction(), we use sequential operations
async processPaymentSettlement(paymentId: string) {
  // 1. Credit cooperative balance
  await creditCooperativeBalance(cooperativeId, baseAmount);
  await markCooperativeBalanceUpdated(paymentId);
  
  // 2. Credit CoPay balance  
  await creditCopayBalance(fee);
  await markFeeBalanceUpdated(paymentId);
}
```

**Benefits:**
- Compatible with all MongoDB deployment types
- Graceful error handling for partial failures
- Idempotent processing prevents duplicate credits
- Comprehensive logging for debugging

### Fee Calculation

```typescript
// Fixed fee of 500 RWF for all transactions
calculatePaymentFee(baseAmount: number): number {
  return 500;
}

calculateTotalAmount(baseAmount: number) {
  const fee = 500;
  return {
    baseAmount,
    fee,
    totalPaid: baseAmount + fee
  };
}
```

### Balance Redistribution

```typescript
// Sequential processing (MongoDB compatible)
async processPaymentSettlement(paymentId: string) {
  // Step 1: Credit cooperative with base amount
  await creditCooperativeBalance(cooperativeId, payment.baseAmount);
  await markCooperativeBalanceUpdated(paymentId);
  
  // Step 2: Credit CoPay with fee
  await creditCopayBalance(payment.fee);
  await markFeeBalanceUpdated(paymentId);
  
  // Each step is tracked individually for resilience
}
```

**Error Handling:**

- If cooperative credit fails → no changes made
- If fee credit fails → cooperative credit already applied
- Idempotency flags prevent duplicate processing
- Failed operations can be retried safely

### Webhook Integration

The webhook handler automatically triggers balance redistribution:

```typescript
if (webhookDto.status === PaymentStatus.COMPLETED) {
  // Log payment completion
  await activityService.logPaymentCompleted();
  
  // Process balance redistribution
  await balanceService.processPaymentSettlement(payment.id);
}
```

## Admin Dashboard Features

### Global Overview

- Total cooperative balances
- CoPay profit statistics  
- Today's transaction activity
- Pending payment amounts

### Cooperative Management

- Individual balance tracking
- Transaction history
- Monthly statistics
- Payment analytics

### Profit Tracking

- Fee collection trends
- Monthly revenue insights
- Transaction volume metrics
- Withdrawal history

## Security & Permissions

### Role-based Access

- **SUPER_ADMIN**: Full access to all balance endpoints and global statistics
- **ORGANIZATION_ADMIN**: Access to own cooperative balance only
- **TENANT**: No direct balance access (handled through payment flow)

### Data Protection

- Balance transactions are immutable once completed
- All financial operations are logged and auditable
- Idempotency keys prevent duplicate processing

## Migration Considerations

### Existing Payments

- Existing payments will continue to work with the `amount` field
- New payments automatically include fee structure
- Gradual migration as new payments are processed

### Backward Compatibility

- Payment APIs maintain existing response structure
- Added new fields without breaking changes
- Legacy integrations continue to function

## Monitoring & Alerts

### Key Metrics

- Daily fee collection amounts
- Balance redistribution success rates
- Payment processing completion times
- Failed redistribution alerts

### Error Handling

- Failed balance redistribution doesn't break payment flow
- Retry mechanisms for settlement processing
- Comprehensive logging for debugging

## Example Usage

### Creating a Payment

```typescript
// Frontend sends
{
  paymentTypeId: "...",
  amount: 50000, // User only pays for base amount
  paymentMethod: "MOBILE_MONEY_MTN",
  // ... other fields
}

// Backend calculates
{
  baseAmount: 50000,
  fee: 500,
  totalPaid: 50500 // This amount is charged to user
}
```

### Admin Dashboard Data

```typescript
// Global overview
{
  totalCooperatives: 25,
  totalCooperativeBalance: 2500000,
  copayProfit: {
    currentBalance: 75000,
    totalFeesCollected: 125000,
    totalTransactions: 250
  }
}
```

## Future Enhancements

### Potential Features

- Variable fee structures based on payment amount
- Bulk withdrawal management for cooperatives
- Advanced analytics and reporting
- Fee discount programs for high-volume cooperatives
- Automated profit sharing mechanisms

### Scalability Considerations

- Balance calculations can be cached for performance
- Transaction logs can be archived for long-term storage
- Real-time balance updates via WebSocket integration
- Automated reconciliation with external accounting systems

---

## Quick Reference

### Fee Structure

- **Transaction Fee**: 500 RWF (fixed)
- **Applied to**: All payment transactions
- **Paid by**: End user (added to base amount)

### Money Flow

1. User pays **Total Amount** (base + fee) to IremboPay
2. IremboPay settles **Total Amount** to CoPay account  
3. CoPay redistributes:
   - **Base Amount** → Cooperative balance
   - **Fee** → CoPay profit

### Admin Endpoints

- `/balances/overview` - Global statistics
- `/balances/cooperative/:id` - Cooperative details
- `/balances/copay` - Profit tracking
- `/balances/calculate` - Fee calculator
