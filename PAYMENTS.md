# Payment API Documentation

## Overview

The Copay Backend Server provides a comprehensive payment system that supports multiple payment methods through a unified IremboPay gateway. The system handles mobile money (MTN, Airtel) and bank transfers (Bank of Kigali, I&M Bank, Ecobank) with proper authentication, authorization, and webhook management.

## Base URL

```
Production: https://api.copay.rw/v1
Development: http://localhost:3000/v1
```

## Authentication

All payment endpoints require JWT Bearer authentication:

```http
Authorization: Bearer <jwt_token>
```

## Payment Methods

The system supports the following payment methods via IremboPay:

- `MOBILE_MONEY_MTN` - MTN Mobile Money
- `MOBILE_MONEY_AIRTEL` - Airtel Money  
- `BANK_BK` - Bank of Kigali
- `BANK_IM` - I&M Bank
- `BANK_ECOBANK` - Ecobank

---

# Payment Endpoints

## 1. Initiate Payment

Creates a new payment request through the IremboPay gateway.

### Endpoint

```http
POST /payments
```

### Request Body

```json
{
  "paymentTypeId": "507f1f77bcf86cd799439011",
  "amount": 50000,
  "paymentMethod": "MOBILE_MONEY_MTN",
  "paymentAccount": "+250788123456",
  "description": "Monthly rent payment for October 2025",
  "dueDate": "2025-11-01T00:00:00Z",
  "idempotencyKey": "payment_67890abcdef12345"
}
```

### Request Parameters

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `paymentTypeId` | string | Yes | ID of the payment type | `"507f1f77bcf86cd799439011"` |
| `amount` | number | Yes | Payment amount in RWF (minimum: 0) | `50000` |
| `paymentMethod` | enum | Yes | Payment method type | `"MOBILE_MONEY_MTN"` |
| `paymentAccount` | string | Yes | Phone number (mobile) or account details | `"+250788123456"` |
| `description` | string | No | Payment description | `"Monthly rent payment"` |
| `dueDate` | string (ISO) | No | Payment due date | `"2025-11-01T00:00:00Z"` |
| `idempotencyKey` | string | Yes | Unique key to prevent duplicates | `"payment_67890abcdef12345"` |

### Response (201 Created)

```json
{
  "id": "67890abcdef12345",
  "amount": 50000,
  "currency": "RWF",
  "status": "PENDING",
  "paymentMethod": "MOBILE_MONEY_MTN",
  "paymentAccount": "+250788123456",
  "reference": "PAY_20251016_001",
  "gatewayTransactionId": "IREMBO_TXN_123456",
  "gatewayReference": "INV_1729123456_abc123",
  "paymentUrl": "https://pay.irembo.gov.rw/invoice/INV_1729123456_abc123",
  "description": "Monthly rent payment for October 2025",
  "dueDate": "2025-11-01T00:00:00Z",
  "createdAt": "2025-10-16T10:30:00Z",
  "updatedAt": "2025-10-16T10:30:00Z"
}
```

### Payment Flow

#### Mobile Money (MTN/Airtel)

1. **Invoice Creation**: System creates an invoice with IremboPay
2. **Push Payment**: Automatically initiates mobile money push to user's phone
3. **User Confirmation**: User receives USSD prompt to confirm payment
4. **Webhook Notification**: IremboPay sends status updates via webhook

#### Bank Payments (BK/I&M/Ecobank)

1. **Invoice Creation**: System creates an invoice with IremboPay
2. **Payment URL**: User redirected to bank's payment portal
3. **Bank Authentication**: User completes payment through bank interface
4. **Webhook Notification**: IremboPay sends status updates via webhook

### Error Responses

#### 400 Bad Request

```json
{
  "statusCode": 400,
  "message": ["amount must be a positive number"],
  "error": "Bad Request"
}
```

#### 401 Unauthorized

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

#### 409 Conflict (Duplicate Idempotency Key)

```json
{
  "statusCode": 409,
  "message": "Payment with this idempotency key already exists",
  "error": "Conflict"
}
```

---

## 2. Get Payment by ID

Retrieves a specific payment by its ID.

### Endpoint

```http
GET /payments/{id}
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Payment ID |

### Response (200 OK)

```json
{
  "id": "67890abcdef12345",
  "amount": 50000,
  "currency": "RWF",
  "status": "COMPLETED",
  "paymentMethod": "MOBILE_MONEY_MTN",
  "paymentAccount": "+250788123456",
  "reference": "PAY_20251016_001",
  "gatewayTransactionId": "IREMBO_TXN_123456",
  "gatewayReference": "INV_1729123456_abc123",
  "paymentUrl": null,
  "description": "Monthly rent payment for October 2025",
  "dueDate": "2025-11-01T00:00:00Z",
  "completedAt": "2025-10-16T10:35:22Z",
  "createdAt": "2025-10-16T10:30:00Z",
  "updatedAt": "2025-10-16T10:35:22Z"
}
```

---

## 3. List Payments

Retrieves a paginated list of payments based on user role.

### Endpoint

```http
GET /payments
```

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 10 | Items per page (max: 100) |
| `status` | string | No | - | Filter by payment status |
| `paymentMethod` | string | No | - | Filter by payment method |

### Response (200 OK)

```json
{
  "data": [
    {
      "id": "67890abcdef12345",
      "amount": 50000,
      "currency": "RWF",
      "status": "COMPLETED",
      "paymentMethod": "MOBILE_MONEY_MTN",
      "reference": "PAY_20251016_001",
      "createdAt": "2025-10-16T10:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

---

# Payment Type Endpoints

## 1. Create Payment Type

Creates a new payment type (Admin only).

### Endpoint

```http
POST /payment-types
```

### Request Body

```json
{
  "name": "Monthly Rent",
  "description": "Monthly rental payment for cooperative housing",
  "amount": 50000,
  "currency": "RWF",
  "isRecurring": true,
  "recurringInterval": "MONTHLY",
  "dueDay": 1,
  "isActive": true
}
```

### Response (201 Created)

```json
{
  "id": "507f1f77bcf86cd799439011",
  "name": "Monthly Rent",
  "description": "Monthly rental payment for cooperative housing",
  "amount": 50000,
  "currency": "RWF",
  "isRecurring": true,
  "recurringInterval": "MONTHLY",
  "dueDay": 1,
  "isActive": true,
  "cooperativeId": "507f1f77bcf86cd799439012",
  "createdAt": "2025-10-16T10:30:00Z",
  "updatedAt": "2025-10-16T10:30:00Z"
}
```

## 2. Get Payment Types

Retrieves payment types for the current cooperative.

### Endpoint

```http
GET /payment-types
```

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 10 | Items per page |
| `includeInactive` | boolean | No | false | Include inactive payment types |

## 3. Get Active Payment Types

Retrieves only active payment types (optimized for mobile/USSD).

### Endpoint

```http
GET /payment-types/active
```

### Response (200 OK)

```json
[
  {
    "id": "507f1f77bcf86cd799439011",
    "name": "Monthly Rent",
    "description": "Monthly rental payment",
    "amount": 50000,
    "currency": "RWF",
    "isRecurring": true,
    "recurringInterval": "MONTHLY",
    "dueDay": 1
  }
]
```

---

# Webhook Endpoints

## IremboPay Webhook

Receives payment status updates from IremboPay gateway.

### Endpoint

```http
POST /webhooks/payments/irembopay
```

### Headers

```
Content-Type: application/json
X-IremboPay-Signature: sha256=<signature>
```

### Webhook Payload

```json
{
  "transaction_id": "IREMBO_TXN_123456",
  "reference": "INV_1729123456_abc123",
  "status": "successful",
  "amount": 50000,
  "currency": "RWF",
  "payment_method": "mtn_momo",
  "phone_number": "+250788123456",
  "failure_reason": null,
  "completed_at": "2025-10-16T10:35:22Z",
  "metadata": {
    "internal_reference": "PAY_20251016_001"
  }
}
```

### Status Values

- `pending` - Payment initiated
- `processing` - Payment being processed
- `successful` / `completed` - Payment completed successfully
- `failed` / `error` - Payment failed
- `cancelled` - Payment cancelled
- `timeout` - Payment timed out

---

# Payment Status Flow

```
PENDING → PROCESSING → COMPLETED
    ↓         ↓           ↑
    ↓         ↓       FAILED
    ↓         ↓           ↑
    ↓     CANCELLED   TIMEOUT
    ↓         ↑           ↑
    → → → → → → → → → → → ←
```

## Status Descriptions

- **PENDING**: Payment initiated, waiting for user action
- **PROCESSING**: Payment being processed by gateway/bank
- **COMPLETED**: Payment successfully completed
- **FAILED**: Payment failed (insufficient funds, network error, etc.)
- **CANCELLED**: Payment cancelled by user or system
- **TIMEOUT**: Payment timed out waiting for user action

---

# Error Handling

## Error Response Format

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2025-10-16T10:30:00Z",
  "path": "/payments"
}
```

## Common HTTP Status Codes

| Code | Description | When it occurs |
|------|-------------|----------------|
| 200 | OK | Successful GET requests |
| 201 | Created | Successful POST requests |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate idempotency key |
| 422 | Unprocessable Entity | Business logic validation failed |
| 500 | Internal Server Error | Server-side errors |

---

# Integration Examples

## Mobile Money Payment (MTN)

```javascript
// 1. Initiate payment
const payment = await fetch('/payments', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    paymentTypeId: '507f1f77bcf86cd799439011',
    amount: 50000,
    paymentMethod: 'MOBILE_MONEY_MTN',
    paymentAccount: '+250788123456',
    description: 'Monthly rent payment',
    idempotencyKey: 'payment_' + Date.now()
  })
});

const paymentData = await payment.json();
console.log('Payment initiated:', paymentData.reference);

// 2. User receives USSD prompt on phone
// 3. User confirms payment
// 4. Webhook updates payment status
```

## Bank Payment (Bank of Kigali)

```javascript
// 1. Initiate payment
const payment = await fetch('/payments', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    paymentTypeId: '507f1f77bcf86cd799439011',
    amount: 50000,
    paymentMethod: 'BANK_BK',
    paymentAccount: 'john.doe@email.com',
    description: 'Monthly rent payment',
    idempotencyKey: 'payment_' + Date.now()
  })
});

const paymentData = await payment.json();

// 2. Redirect user to payment URL
window.location.href = paymentData.paymentUrl;

// 3. User completes payment on bank portal
// 4. User redirected back to application
// 5. Webhook updates payment status
```

---

# Testing

## Test Webhook Endpoint

For development and testing purposes:

### Endpoint

```http
POST /webhooks/payments/test
```

### Test Payload

```json
{
  "gatewayTransactionId": "TEST_TXN_123456",
  "status": "COMPLETED",
  "gatewayReference": "TEST_REF_123456",
  "failureReason": null,
  "gatewayData": {
    "test": true,
    "amount": 50000
  }
}
```

## Test Phone Numbers

For testing mobile money in development:

- **MTN Success**: +250788000001
- **MTN Failure**: +250788000002
- **Airtel Success**: +250733000001  
- **Airtel Failure**: +250733000002

---

# Security

## Authentication

- JWT Bearer tokens required for all endpoints
- Tokens include user role and cooperative context

## Authorization

- **Tenants**: Can only initiate payments and view their own payments
- **Organization Admins**: Can manage payment types and view all payments in their cooperative
- **Super Admins**: Full access across all cooperatives

## Webhook Security

- HMAC-SHA256 signature verification for IremboPay webhooks
- Signature header: `X-IremboPay-Signature`
- Payload integrity verification prevents tampering

## Idempotency

- Required `idempotencyKey` prevents duplicate payments
- Same key returns existing payment instead of creating duplicate
- Keys should be unique per cooperative/tenant

---

# Rate Limits

| Endpoint | Rate Limit | Window |
|----------|------------|--------|
| POST /payments | 10 requests/minute | Per user |
| GET /payments | 100 requests/minute | Per user |
| POST /payment-types | 20 requests/minute | Per user |
| Webhooks | 1000 requests/minute | Per IP |

---

# Support

For API support and integration assistance:

- **Email**: <api-support@copay.rw>
- **Documentation**: <https://docs.copay.rw/api>
- **Status Page**: <https://status.copay.rw>

## Webhook Debugging

- Monitor webhook deliveries in IremboPay dashboard
- Check application logs for webhook processing errors
- Use test webhook endpoint for development

## Common Issues

1. **Payment Stuck in PENDING**: Check user's phone for USSD prompt
2. **Webhook Signature Verification Failed**: Verify secret key configuration
3. **Duplicate Payment Error**: Check idempotency key uniqueness
4. **Invalid Phone Number**: Ensure format +250XXXXXXXXX for Rwanda numbers
