# Copay Backend Server - Complete API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Authentication](#authentication)
4. [API Endpoints](#api-endpoints)
   - [Authentication Endpoints](#authentication-endpoints)
   - [User Management](#user-management)
   - [Cooperatives](#cooperatives)
   - [Payment Types (Public)](#payment-types-public)
   - [Payments](#payments)
   - [Activities](#activities)
   - [Reminders](#reminders)
   - [Complaints](#complaints)
   - [Webhooks](#webhooks)
5. [Data Models](#data-models)
6. [Security](#security)
7. [Error Handling](#error-handling)
8. [Integration Examples](#integration-examples)
9. [Testing Guide](#testing-guide)

---

## Overview

The Copay Backend Server provides a comprehensive API for managing cooperative housing payments, user activities, and automated reminders. The system supports multi-tenancy, role-based access control, and integrates with multiple payment gateways.

### Base URLs

```
Production: https://api.copay.rw/v1
Development: http://localhost:3000/v1
Swagger UI: http://localhost:3000/docs
```

### Key Features

- **Multi-tenant Architecture**: Complete cooperative isolation
- **Role-based Access Control**: SUPER_ADMIN, ORGANIZATION_ADMIN, TENANT
- **Payment Gateway Integration**: IremboPay with mobile money and bank support
- **Activity Tracking**: Comprehensive audit logging
- **Automated Reminders**: Multi-channel notifications (SMS, email, in-app, push)
- **Public APIs**: No authentication required for reading payment types
- **Real-time Webhooks**: Payment status updates

---

## Getting Started

### 1. Authentication Setup

First, obtain an access token by logging in:

```bash
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+250788000001",
    "pin": "1234"
  }'
```

### 2. Using the Access Token

Include the token in all authenticated requests:

```bash
curl -X GET http://localhost:3000/v1/users \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3. Seeded Data

The application comes with pre-seeded data for testing:

- **Super Admin**: +250788000001 (PIN: 1234)
- **Organization Admin**: +250788000002 (PIN: 2345)  
- **Tenants**: +250788000003, +250788000004 (PIN: 3456)
- **Default Cooperative**: "Default Cooperative" (Code: DEFAULT_COOP)

---

## Authentication

### JWT Bearer Authentication

All protected endpoints require a JWT Bearer token:

```
Authorization: Bearer <jwt_token>
```

### Token Properties

- **Expiration**: 7 days
- **Refresh**: Not implemented (re-authenticate after expiration)
- **Payload**: Contains user ID, role, and cooperative context

### Public Endpoints

Some endpoints are public and don't require authentication:

- `GET /payment-types/*` - All payment type read operations
- `POST /webhooks/*` - Webhook callbacks
- `GET /health` - Health check

---

## API Endpoints

### Authentication Endpoints

#### Login

**POST** `/auth/login`

**Request Body:**

```json
{
  "phone": "+250788000001",
  "pin": "1234",
  "fcmToken": "eK4VUu1234567890:APA91bFwOoE1234567890abcdefgh..."
}
```

**Parameters:**

- `phone` (required): Phone number with country code
- `pin` (required): 4-digit PIN
- `fcmToken` (optional): Firebase Cloud Messaging token for push notifications

**Response:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 604800,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "phone": "+250788000001",
    "role": "SUPER_ADMIN",
    "cooperativeId": "507f1f77bcf86cd799439012"
  }
}
```

**Notes:**

- When `fcmToken` is provided, it will be stored for the user and used for push notifications
- The FCM token is updated each time the user logs in with a new token
- Push notifications will be sent to the most recent FCM token provided

#### Pin Reset

**POST** `/auth/pin-reset`

```json
{
  "phone": "+250788000001"
}
```

#### Confirm Pin Reset

**POST** `/auth/confirm-pin-reset`

```json
{
  "phone": "+250788000001",
  "resetCode": "123456",
  "newPin": "5678"
}
```

---

### User Management

#### Create User

**POST** `/users`

**Required Roles:** `SUPER_ADMIN`, `ORGANIZATION_ADMIN`

```json
{
  "phone": "+250788111224",
  "pin": "3456",
  "firstName": "Jean",
  "lastName": "Mukamana",
  "email": "jean.mukamana@example.com",
  "role": "TENANT",
  "cooperativeId": "507f1f77bcf86cd799439012"
}
```

#### List Users

**GET** `/users`

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `search` (optional): Search by name, phone, or email
- `role` (optional): Filter by user role
- `status` (optional): Filter by user status

#### Get User by ID

**GET** `/users/:id`

#### Update User Status

**PATCH** `/users/:id/status`

```json
{
  "isActive": false
}
```

---

### Cooperatives

#### Create Cooperative

**POST** `/cooperatives`

**Required Roles:** `SUPER_ADMIN`

```json
{
  "name": "Nyamirambo Housing Cooperative",
  "code": "NHC001",
  "description": "A housing cooperative in Nyamirambo",
  "address": "Nyamirambo, Kigali, Rwanda",
  "phone": "+250788111222",
  "email": "admin@nyamirambo.coop",
  "settings": {
    "currency": "RWF",
    "timezone": "Africa/Kigali",
    "paymentDueDay": 15,
    "reminderDays": [7, 3, 1]
  }
}
```

#### List Cooperatives

**GET** `/cooperatives`

**Query Parameters:**

- `page`, `limit`, `search` (same as users)

#### Get Cooperative by ID

**GET** `/cooperatives/:id`

---

### Payment Types (Public)

**Note:** These endpoints are public and don't require authentication.

#### Get All Payment Types

**GET** `/payment-types` 🌍 *Public*

**Query Parameters:**

- `cooperativeId` (required): The cooperative ID
- `page`, `limit`, `search` (optional)
- `includeInactive` (optional): Include inactive payment types

```bash
curl -X GET "https://api.copay.com/payment-types?cooperativeId=507f1f77bcf86cd799439012&page=1&limit=20"
```

**Response:**

```json
{
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "Monthly Rent",
      "description": "Monthly rental payment",
      "amount": 50000,
      "amountType": "FIXED",
      "isActive": true,
      "allowPartialPayment": false,
      "minimumAmount": null,
      "dueDay": 1,
      "isRecurring": true,
      "cooperativeId": "507f1f77bcf86cd799439012",
      "settings": {},
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 20,
    "totalPages": 2,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

#### Get Active Payment Types

**GET** `/payment-types/active` 🌍 *Public*

Optimized endpoint for USSD and mobile apps.

```bash
curl -X GET "https://api.copay.com/payment-types/active?cooperativeId=507f1f77bcf86cd799439012"
```

#### Get Payment Type by ID

**GET** `/payment-types/:id` 🌍 *Public*

```bash
curl -X GET "https://api.copay.com/payment-types/507f1f77bcf86cd799439011?cooperativeId=507f1f77bcf86cd799439012"
```

#### Create Payment Type

**POST** `/payment-types` 🔒 *Requires Auth*

**Required Roles:** `ORGANIZATION_ADMIN`, `SUPER_ADMIN`

```json
{
  "name": "Monthly Rent",
  "description": "Monthly rental payment for cooperative housing",
  "amount": 50000,
  "amountType": "FIXED",
  "allowPartialPayment": false,
  "minimumAmount": null,
  "dueDay": 1,
  "isRecurring": true,
  "isActive": true
}
```

---

### Payments

#### Initiate Payment

**POST** `/payments`

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

**Supported Payment Methods:**

- `MOBILE_MONEY_MTN` - MTN Mobile Money
- `MOBILE_MONEY_AIRTEL` - Airtel Money
- `BANK_BK` - Bank of Kigali
- `BANK_IM` - I&M Bank
- `BANK_ECOBANK` - Ecobank

**Response:**

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

#### Get Payment by ID

**GET** `/payments/:id`

#### List Payments

**GET** `/payments`

**Query Parameters:**

- `page`, `limit` (pagination)
- `status` (filter): `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`, `TIMEOUT`
- `paymentMethod` (filter)

---

### Organization Payment Management

**Note:** These endpoints are available only to `ORGANIZATION_ADMIN` and `SUPER_ADMIN` roles.

#### Get Organization Payments

**GET** `/payments/organization` 🔒 *Admin Only*

**Description:** Organization admins can view all payments from their cooperative tenants with advanced filtering options.

**Required Roles:** `ORGANIZATION_ADMIN`, `SUPER_ADMIN`

**Query Parameters:**

- `page`, `limit` (pagination)
- `search` (optional): Search by description, reference, sender name, or payment type
- `status` (optional): Filter by payment status
- `paymentMethod` (optional): Filter by payment method
- `senderId` (optional): Filter by specific sender
- `paymentTypeId` (optional): Filter by payment type
- `fromDate` (optional): Start date filter (ISO 8601)
- `toDate` (optional): End date filter (ISO 8601)
- `sortBy`, `sortOrder` (optional): Sort results

```bash
curl -X GET "https://api.copay.com/payments/organization?page=1&limit=20&status=COMPLETED&fromDate=2025-10-01T00:00:00Z" \
  -H "Authorization: Bearer <admin_token>"
```

**Response:**

```json
{
  "data": [
    {
      "id": "67890abcdef12345",
      "amount": 50000,
      "status": "COMPLETED",
      "description": "Monthly rent payment",
      "paymentMethod": "MOBILE_MONEY_MTN",
      "paymentReference": "PAY_20251016_001",
      "paymentType": {
        "id": "507f1f77bcf86cd799439011",
        "name": "Monthly Rent",
        "description": "Monthly rental payment"
      },
      "sender": {
        "id": "507f1f77bcf86cd799439013",
        "firstName": "Jean",
        "lastName": "Mukamana",
        "phone": "+250788123456"
      },
      "cooperative": {
        "id": "507f1f77bcf86cd799439012",
        "name": "Default Cooperative",
        "code": "DEFAULT_COOP"
      },
      "latestTransaction": {
        "id": "transaction_123",
        "status": "COMPLETED",
        "gatewayTransactionId": "IREMBO_TXN_123456",
        "createdAt": "2025-10-16T10:30:00Z"
      },
      "paidAt": "2025-10-16T10:35:00Z",
      "createdAt": "2025-10-16T10:30:00Z",
      "updatedAt": "2025-10-16T10:35:00Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

#### Get Organization Payment Details

**GET** `/payments/organization/:id` 🔒 *Admin Only*

**Description:** Organization admins can view detailed payment information including full transaction history.

```bash
curl -X GET "https://api.copay.com/payments/organization/67890abcdef12345" \
  -H "Authorization: Bearer <admin_token>"
```

**Response:**

```json
{
  "id": "67890abcdef12345",
  "amount": 50000,
  "status": "COMPLETED",
  "description": "Monthly rent payment",
  "paymentMethod": "MOBILE_MONEY_MTN",
  "paymentReference": "PAY_20251016_001",
  "paymentType": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Monthly Rent",
    "description": "Monthly rental payment",
    "amount": 50000,
    "amountType": "FIXED"
  },
  "sender": {
    "id": "507f1f77bcf86cd799439013",
    "firstName": "Jean",
    "lastName": "Mukamana",
    "phone": "+250788123456",
    "email": "jean.mukamana@example.com"
  },
  "cooperative": {
    "id": "507f1f77bcf86cd799439012",
    "name": "Default Cooperative",
    "code": "DEFAULT_COOP"
  },
  "transactions": [
    {
      "id": "transaction_123",
      "amount": 50000,
      "status": "COMPLETED",
      "paymentMethod": "MOBILE_MONEY_MTN",
      "gatewayTransactionId": "IREMBO_TXN_123456",
      "gatewayReference": "INV_1729123456_abc123",
      "gatewayResponse": {
        "transaction_id": "IREMBO_TXN_123456",
        "status": "successful",
        "phone_number": "+250788123456"
      },
      "processingStartedAt": "2025-10-16T10:30:15Z",
      "processingCompletedAt": "2025-10-16T10:35:22Z",
      "failureReason": null,
      "webhookReceived": true,
      "webhookReceivedAt": "2025-10-16T10:35:22Z",
      "createdAt": "2025-10-16T10:30:00Z",
      "updatedAt": "2025-10-16T10:35:22Z"
    }
  ],
  "paidAt": "2025-10-16T10:35:00Z",
  "createdAt": "2025-10-16T10:30:00Z",
  "updatedAt": "2025-10-16T10:35:00Z"
}
```

#### Get Organization Payment Statistics

**GET** `/payments/organization/stats` 🔒 *Admin Only*

**Description:** Get payment summary statistics for the organization including total amounts, payment counts, and status breakdown.

**Query Parameters:**

- `fromDate` (optional): Start date for statistics (ISO 8601)
- `toDate` (optional): End date for statistics (ISO 8601)

```bash
curl -X GET "https://api.copay.com/payments/organization/stats?fromDate=2025-10-01T00:00:00Z&toDate=2025-10-31T23:59:59Z" \
  -H "Authorization: Bearer <admin_token>"
```

**Response:**

```json
{
  "summary": {
    "totalPayments": 245,
    "totalAmount": 12250000,
    "averageAmount": 50000
  },
  "statusBreakdown": [
    {
      "status": "COMPLETED",
      "count": 200,
      "totalAmount": 10000000
    },
    {
      "status": "PENDING",
      "count": 25,
      "totalAmount": 1250000
    },
    {
      "status": "FAILED",
      "count": 20,
      "totalAmount": 1000000
    }
  ],
  "methodBreakdown": [
    {
      "method": "MOBILE_MONEY_MTN",
      "count": 150,
      "totalAmount": 7500000
    },
    {
      "method": "MOBILE_MONEY_AIRTEL",
      "count": 70,
      "totalAmount": 3500000
    },
    {
      "method": "BANK_BK",
      "count": 25,
      "totalAmount": 1250000
    }
  ],
  "recentPayments": [
    {
      "id": "67890abcdef12345",
      "amount": 50000,
      "status": "COMPLETED",
      "paymentType": "Monthly Rent",
      "sender": "Jean Mukamana",
      "senderPhone": "+250788123456",
      "createdAt": "2025-10-16T10:30:00Z"
    }
  ]
}
```

---

### Activities

The Activity API provides comprehensive user activity tracking and audit logging.

#### Create Activity

**POST** `/activities`

```json
{
  "type": "LOGIN",
  "description": "User logged in successfully",
  "entityType": "USER",
  "entityId": "507f1f77bcf86cd799439011",
  "metadata": {
    "loginMethod": "credentials",
    "deviceType": "mobile"
  },
  "isSecurityEvent": false
}
```

#### Get All Activities

**GET** `/activities`

**Access Control:**

- **TENANT**: See only their own activities
- **ORGANIZATION_ADMIN**: See activities within their cooperative
- **SUPER_ADMIN**: See all activities across all cooperatives

**Query Parameters:**

- `page`, `limit`, `search`, `sortBy`, `sortOrder`
- `type` (optional): Activity type filter
- `entityType` (optional): `USER`, `PAYMENT`, `COOPERATIVE`, `REMINDER`, `SYSTEM`
- `entityId` (optional): Specific entity ID
- `userId` (optional): Filter by user ID
- `cooperativeId` (optional): Filter by cooperative ID
- `fromDate`, `toDate` (optional): Date range filter (ISO 8601)
- `isSecurityEvent` (optional): Filter security events only

#### Get Current User Activities

**GET** `/activities/me`

#### Get Security Activities

**GET** `/activities/security`

**Required Roles:** `SUPER_ADMIN`, `ORGANIZATION_ADMIN`

**Activity Types Include:**

- Authentication: `LOGIN`, `LOGOUT`, `LOGIN_FAILED`, `PASSWORD_RESET`
- Payments: `PAYMENT_CREATED`, `PAYMENT_COMPLETED`, `PAYMENT_FAILED`
- User Management: `USER_CREATED`, `USER_UPDATED`, `USER_DELETED`
- Security Events: `SUSPICIOUS_LOGIN`, `MULTIPLE_FAILED_LOGINS`, `UNAUTHORIZED_ACCESS`

---

### Reminders

The Reminder API provides automated payment reminders with multi-channel notifications.

#### Create Reminder

**POST** `/reminders`

```json
{
  "title": "Monthly Rent Payment",
  "description": "Remember to pay rent before the due date",
  "type": "PAYMENT_DUE",
  "paymentTypeId": "507f1f77bcf86cd799439011",
  "reminderDate": "2025-11-01T09:00:00Z",
  "isRecurring": true,
  "recurringPattern": "MONTHLY",
  "notificationTypes": ["SMS", "IN_APP"],
  "advanceNoticeDays": 3,
  "customAmount": 50000,
  "notes": "Don't forget to include the reference number"
}
```

**Reminder Types:**

- `PAYMENT_DUE` - Standard payment due reminder
- `PAYMENT_OVERDUE` - Overdue payment reminder  
- `CUSTOM` - Custom reminder type

**Notification Types:**

- `SMS` - SMS notification
- `EMAIL` - Email notification
- `IN_APP` - In-app notification
- `PUSH` - Push notification

**Recurring Patterns:**

- `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`

#### Get All Reminders

**GET** `/reminders`

**Query Parameters:**

- `page`, `limit`, `search`, `sortBy`, `sortOrder`
- `type` (optional): Reminder type filter
- `status` (optional): `ACTIVE`, `PAUSED`, `COMPLETED`, `CANCELLED`
- `paymentTypeId` (optional): Filter by payment type
- `fromDate`, `toDate` (optional): Date range filter
- `isRecurring` (optional): Filter recurring reminders
- `isDue` (optional): Filter due reminders

#### Get Current User Reminders

**GET** `/reminders/me`

#### Get Due Reminders

**GET** `/reminders/due`

#### Get Reminder by ID

**GET** `/reminders/:id`

#### Update Reminder

**PUT** `/reminders/:id`

#### Delete Reminder

**DELETE** `/reminders/:id`

---

### Complaints

The Complaints API provides comprehensive complaint management for both tenants and organization administrators.

#### Create Complaint

**POST** `/complaints`

**Required Roles:** `TENANT`, `ORGANIZATION_ADMIN`, `SUPER_ADMIN`

```json
{
  "cooperativeId": "507f1f77bcf86cd799439012",
  "title": "Water pressure issue in apartment 301",
  "description": "The water pressure in the bathroom has been very low for the past week. It affects daily activities like showering and washing dishes.",
  "priority": "MEDIUM",
  "attachments": [
    {
      "filename": "water_issue_photo.jpg",
      "url": "https://storage.example.com/complaints/photo1.jpg",
      "size": 2048576,
      "contentType": "image/jpeg"
    }
  ]
}
```

**Fields:**
- `cooperativeId` (optional): ID of the cooperative/organization this complaint is for. If not provided, defaults to the user's cooperative.
- `title` (required): Title of the complaint
- `description` (required): Detailed description of the complaint  
- `priority` (optional): Priority level (LOW, MEDIUM, HIGH, URGENT). Defaults to MEDIUM.
- `attachments` (optional): Array of attachment metadata

**Access Control:**
- **Tenants**: Can only create complaints for their own cooperative
- **Organization Admins**: Can only create complaints for their own cooperative  
- **Super Admins**: Can create complaints for any cooperative

**Priority Levels:**
- `LOW`, `MEDIUM`, `HIGH`, `URGENT`

**Response:**

```json
{
  "id": "507f1f77bcf86cd799439015",
  "title": "Water pressure issue in apartment 301",
  "description": "The water pressure in the bathroom has been very low for the past week.",
  "status": "OPEN",
  "priority": "MEDIUM",
  "resolution": null,
  "resolvedAt": null,
  "attachments": [
    {
      "filename": "water_issue_photo.jpg",
      "url": "https://storage.example.com/complaints/photo1.jpg",
      "size": 2048576,
      "contentType": "image/jpeg"
    }
  ],
  "user": {
    "id": "507f1f77bcf86cd799439013",
    "firstName": "Jean",
    "lastName": "Mukamana",
    "phone": "+250788123456"
  },
  "cooperative": {
    "id": "507f1f77bcf86cd799439012",
    "name": "Default Cooperative",
    "code": "DEFAULT_COOP"
  },
  "createdAt": "2025-10-31T10:30:00Z",
  "updatedAt": "2025-10-31T10:30:00Z"
}
```

#### Get All Complaints

**GET** `/complaints`

**Access Control:**

- **TENANT**: See only their own complaints
- **ORGANIZATION_ADMIN**: See all complaints within their cooperative
- **SUPER_ADMIN**: See all complaints across all cooperatives

**Query Parameters:**

- `page`, `limit`, `search`, `sortBy`, `sortOrder` (pagination)
- `status` (optional): Filter by complaint status (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`)
- `priority` (optional): Filter by priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`)
- `userId` (optional): Filter by user ID (admin only)
- `fromDate`, `toDate` (optional): Date range filter (ISO 8601)

#### Get My Complaints

**GET** `/complaints/my`

**Description:** Get complaints submitted by the current user (regardless of role).

#### Get Organization Complaints

**GET** `/complaints/organization` 🔒 *Admin Only*

**Required Roles:** `ORGANIZATION_ADMIN`, `SUPER_ADMIN`

**Description:** Organization admins can view all complaints from their cooperative tenants.

```bash
curl -X GET "https://api.copay.com/complaints/organization?status=OPEN&priority=HIGH&page=1&limit=20" \
  -H "Authorization: Bearer <admin_token>"
```

#### Get Organization Complaint Statistics

**GET** `/complaints/organization/stats` 🔒 *Admin Only*

**Required Roles:** `ORGANIZATION_ADMIN`, `SUPER_ADMIN`

**Query Parameters:**

- `fromDate` (optional): Start date for statistics (ISO 8601)
- `toDate` (optional): End date for statistics (ISO 8601)

```bash
curl -X GET "https://api.copay.com/complaints/organization/stats?fromDate=2025-10-01T00:00:00Z" \
  -H "Authorization: Bearer <admin_token>"
```

**Response:**

```json
{
  "summary": {
    "totalComplaints": 45
  },
  "statusBreakdown": [
    {
      "status": "OPEN",
      "count": 15
    },
    {
      "status": "IN_PROGRESS",
      "count": 12
    },
    {
      "status": "RESOLVED",
      "count": 15
    },
    {
      "status": "CLOSED",
      "count": 3
    }
  ],
  "priorityBreakdown": [
    {
      "priority": "HIGH",
      "count": 8
    },
    {
      "priority": "MEDIUM",
      "count": 25
    },
    {
      "priority": "LOW",
      "count": 12
    }
  ],
  "recentComplaints": [
    {
      "id": "507f1f77bcf86cd799439015",
      "title": "Water pressure issue in apartment 301",
      "status": "OPEN",
      "priority": "MEDIUM",
      "user": "Jean Mukamana",
      "userPhone": "+250788123456",
      "createdAt": "2025-10-31T10:30:00Z"
    }
  ]
}
```

#### Get Complaint by ID

**GET** `/complaints/:id`

**Access Control:**

- **TENANT**: Can only view their own complaints
- **ORGANIZATION_ADMIN**: Can view complaints within their cooperative
- **SUPER_ADMIN**: Can view any complaint

#### Update Complaint Status

**PATCH** `/complaints/:id/status` 🔒 *Admin Only*

**Required Roles:** `ORGANIZATION_ADMIN`, `SUPER_ADMIN`

**Description:** Organization admins can update complaint status and add resolution messages.

```json
{
  "status": "IN_PROGRESS",
  "resolution": "Maintenance team has been notified and will address the water pressure issue within 24 hours."
}
```

**Status Values:**

- `OPEN` - Newly submitted complaint
- `IN_PROGRESS` - Being worked on by maintenance/admin
- `RESOLVED` - Issue has been fixed
- `CLOSED` - Complaint is closed (resolved or dismissed)

**Response:**

```json
{
  "id": "507f1f77bcf86cd799439015",
  "title": "Water pressure issue in apartment 301",
  "description": "The water pressure in the bathroom has been very low for the past week.",
  "status": "IN_PROGRESS",
  "priority": "MEDIUM",
  "resolution": "Maintenance team has been notified and will address the water pressure issue within 24 hours.",
  "resolvedAt": null,
  "user": {
    "id": "507f1f77bcf86cd799439013",
    "firstName": "Jean",
    "lastName": "Mukamana",
    "phone": "+250788123456"
  },
  "cooperative": {
    "id": "507f1f77bcf86cd799439012",
    "name": "Default Cooperative",
    "code": "DEFAULT_COOP"
  },
  "createdAt": "2025-10-31T10:30:00Z",
  "updatedAt": "2025-10-31T14:15:00Z"
}
```

**Note:** When status is set to `RESOLVED` or `CLOSED`, the `resolvedAt` timestamp is automatically set.

---

### Notifications

The Notifications API provides in-app notifications and push notification management.

#### Get In-App Notifications

**GET** `/notifications/in-app`

**Description:** Get in-app notifications for the current user.

**Query Parameters:**

- `limit` (optional): Maximum number of notifications to return (default: 20)

**Response:**

```json
{
  "data": [
    {
      "id": "507f1f77bcf86cd799439020",
      "type": "IN_APP",
      "status": "SENT",
      "title": "Monthly Rent Due Reminder",
      "message": "Your Monthly Rent is due (Amount: RWF 50,000). Please make your payment on time.",
      "createdAt": "2025-11-02T10:30:00Z",
      "reminder": {
        "id": "507f1f77bcf86cd799439019",
        "title": "Monthly Rent Payment",
        "type": "PAYMENT_DUE"
      },
      "payment": null
    }
  ]
}
```

#### Mark Notification as Read

**PATCH** `/notifications/in-app/:id/read`

**Description:** Mark an in-app notification as read.

**Response:**

```json
{
  "message": "Notification marked as read"
}
```

#### Push Notification Features

**Automatic Push Notifications:**

- **Payment Reminders**: Sent based on user's reminder preferences
- **Payment Status Updates**: Sent when payment status changes
- **Account Updates**: Sent for important account changes

**Notification Types:**

- `SMS` - Text message notifications
- `EMAIL` - Email notifications (coming soon)
- `IN_APP` - In-app notifications stored in database
- `PUSH_NOTIFICATION` - Firebase Cloud Messaging push notifications

**FCM Token Management:**

- FCM tokens are automatically updated during login
- Users receive push notifications on their most recent device
- Invalid tokens are automatically cleaned up during retry attempts

---

### Webhooks

#### IremboPay Webhook

**POST** `/webhooks/payments/irembopay` 🌍 *Public*

Receives payment status updates from IremboPay gateway.

**Headers:**

```
Content-Type: application/json
X-IremboPay-Signature: sha256=<signature>
```

**Payload:**

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
  "completed_at": "2025-10-16T10:35:22Z"
}
```

---

## Data Models

### User

```typescript
{
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email?: string;
  role: 'SUPER_ADMIN' | 'ORGANIZATION_ADMIN' | 'TENANT';
  cooperativeId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Cooperative

```typescript
{
  id: string;
  name: string;
  code: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  settings: object;
  createdAt: Date;
  updatedAt: Date;
}
```

### Payment Type

```typescript
{
  id: string;
  name: string;
  description?: string;
  amount: number;
  amountType: 'FIXED' | 'VARIABLE';
  isActive: boolean;
  allowPartialPayment: boolean;
  minimumAmount?: number;
  dueDay?: number;
  isRecurring: boolean;
  cooperativeId: string;
  settings?: object;
  createdAt: Date;
  updatedAt: Date;
}
```

### Payment

```typescript
{
  id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMEOUT';
  paymentMethod: string;
  paymentAccount: string;
  reference: string;
  gatewayTransactionId?: string;
  gatewayReference?: string;
  paymentUrl?: string;
  description?: string;
  dueDate?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Activity

```typescript
{
  id: string;
  type: ActivityType;
  description: string;
  entityType: 'USER' | 'PAYMENT' | 'COOPERATIVE' | 'REMINDER' | 'SYSTEM';
  entityId: string;
  userId: string;
  cooperativeId?: string;
  metadata?: object;
  ipAddress?: string;
  userAgent?: string;
  isSecurityEvent: boolean;
  createdAt: Date;
}
```

### Reminder

```typescript
{
  id: string;
  title: string;
  description?: string;
  type: 'PAYMENT_DUE' | 'PAYMENT_OVERDUE' | 'CUSTOM';
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  userId: string;
  paymentTypeId?: string;
  reminderDate: Date;
  isRecurring: boolean;
  recurringPattern?: string;
  notificationTypes: NotificationType[];
  advanceNoticeDays?: number;
  customAmount?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Security

### Authentication & Authorization

- **JWT Bearer Tokens**: 7-day expiration
- **Role-Based Access Control**: SUPER_ADMIN > ORGANIZATION_ADMIN > TENANT
- **Multi-Tenant Isolation**: Automatic cooperative-level data filtering

### API Security

- **Rate Limiting**: 100 requests/minute per user
- **CORS Protection**: Configurable origins
- **Input Validation**: Class-validator decorators
- **SQL Injection Prevention**: Prisma ORM parameterized queries

### Webhook Security

- **HMAC-SHA256 Signature Verification**: For IremboPay webhooks
- **Payload Integrity**: Prevents tampering
- **IP Whitelisting**: Production webhook sources

### Data Protection

- **PII Encryption**: Sensitive data encrypted at rest
- **Audit Logging**: Complete activity trail
- **Access Logs**: Request/response logging

---

## Error Handling

### Standard Error Response

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2025-10-16T10:30:00Z",
  "path": "/payments"
}
```

### HTTP Status Codes

| Code | Description           | When it occurs                   |
| ---- | --------------------- | -------------------------------- |
| 200  | OK                    | Successful GET requests          |
| 201  | Created               | Successful POST requests         |
| 204  | No Content            | Successful DELETE requests       |
| 400  | Bad Request           | Invalid request data             |
| 401  | Unauthorized          | Missing/invalid authentication   |
| 403  | Forbidden             | Insufficient permissions         |
| 404  | Not Found             | Resource not found               |
| 409  | Conflict              | Duplicate resource (idempotency) |
| 422  | Unprocessable Entity  | Business logic validation        |
| 429  | Too Many Requests     | Rate limit exceeded              |
| 500  | Internal Server Error | Server-side errors               |

### Validation Errors

```json
{
  "statusCode": 400,
  "message": [
    "phone must be a valid phone number",
    "amount must be a positive number"
  ],
  "error": "Bad Request"
}
```

---

## Integration Examples

### Mobile Money Payment Flow

```javascript
// 1. Get active payment types (public API)
const paymentTypes = await fetch(
  'https://api.copay.com/payment-types/active?cooperativeId=507f1f77bcf86cd799439012'
);

// 2. Initiate payment
const payment = await fetch('/v1/payments', {
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
    idempotencyKey: 'payment_' + Date.now()
  })
});

// 3. User receives USSD prompt and confirms
// 4. Webhook updates payment status automatically
```

### Creating Automated Reminders

```javascript
// Create monthly rent reminder
const reminder = await fetch('/v1/reminders', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Monthly Rent Payment',
    type: 'PAYMENT_DUE',
    paymentTypeId: '507f1f77bcf86cd799439011',
    reminderDate: '2025-11-01T09:00:00Z',
    isRecurring: true,
    recurringPattern: 'MONTHLY',
    notificationTypes: ['SMS', 'IN_APP'],
    advanceNoticeDays: 3
  })
});
```

### USSD Integration

```javascript
// Get payment types for USSD menu (public API)
const response = await fetch(
  'https://api.copay.com/payment-types/active?cooperativeId=507f1f77bcf86cd799439012'
);
const paymentTypes = await response.json();

// Display in USSD menu
let menu = 'Select payment type:\\n';
paymentTypes.forEach((type, index) => {
  menu += `${index + 1}. ${type.name} - ${type.amount} RWF\\n`;
});
```

### Activity Monitoring Dashboard

```javascript
// Get security events (admin only)
const securityEvents = await fetch('/v1/activities/security?isSecurityEvent=true&limit=50', {
  headers: { 'Authorization': 'Bearer ' + adminToken }
});

// Get user activities with filters
const userActivities = await fetch(
  '/v1/activities?entityType=USER&type=LOGIN&fromDate=2025-10-01T00:00:00Z',
  { headers: { 'Authorization': 'Bearer ' + token } }
);
```

---

## Testing Guide

### Phase 1: Authentication & Setup

1. **Login as Super Admin:**

   ```bash
   curl -X POST http://localhost:3000/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"phone": "+250788000001", "pin": "1234"}'
   ```

2. **Create Cooperative:**

   ```bash
   curl -X POST http://localhost:3000/v1/cooperatives \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Cooperative",
       "code": "TEST001",
       "description": "Test cooperative for API testing"
     }'
   ```

3. **Create Organization Admin:**

   ```bash
   curl -X POST http://localhost:3000/v1/users \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "phone": "+250788111223",
       "pin": "2345",
       "firstName": "Admin",
       "lastName": "User",
       "role": "ORGANIZATION_ADMIN",
       "cooperativeId": "COOPERATIVE_ID"
     }'
   ```

### Phase 2: Payment Types (Public API)

```bash
# Test public payment types API
curl -X GET "http://localhost:3000/payment-types/active?cooperativeId=COOPERATIVE_ID"
```

### Phase 3: Payments & Reminders

1. **Create Payment Type (as Admin):**

   ```bash
   curl -X POST http://localhost:3000/payment-types \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -d '{"name": "Rent", "amount": 50000, "isActive": true}'
   ```

2. **Create Reminder (as Tenant):**

   ```bash
   curl -X POST http://localhost:3000/v1/reminders \
     -H "Authorization: Bearer TENANT_TOKEN" \
     -d '{
       "title": "Rent Reminder",
       "type": "PAYMENT_DUE",
       "paymentTypeId": "PAYMENT_TYPE_ID",
       "reminderDate": "2025-11-01T09:00:00Z"
     }'
   ```

### Test Data

Use these test credentials:

| Role               | Phone         | PIN  | Description            |
| ------------------ | ------------- | ---- | ---------------------- |
| SUPER_ADMIN        | +250788000001 | 1234 | Full system access     |
| ORGANIZATION_ADMIN | +250788000002 | 2345 | Cooperative management |
| TENANT             | +250788000003 | 3456 | Basic user operations  |
| TENANT             | +250788000004 | 3456 | Additional test user   |

### Test Phone Numbers for Payments

| Provider | Success Number | Failure Number |
| -------- | -------------- | -------------- |
| MTN      | +250788000001  | +250788000002  |
| Airtel   | +250733000001  | +250733000002  |

---

## Rate Limits

| Endpoint Category | Rate Limit           | Window   | Notes             |
| ----------------- | -------------------- | -------- | ----------------- |
| Authentication    | 5 requests/minute    | Per IP   | Login attempts    |
| Payments          | 10 requests/minute   | Per user | Payment creation  |
| Public APIs       | 100 requests/minute  | Per IP   | Payment types     |
| General APIs      | 100 requests/minute  | Per user | Most endpoints    |
| Webhooks          | 1000 requests/minute | Per IP   | Callback handlers |

---

## Support & Resources

### Documentation

- **API Documentation**: This document
- **Swagger UI**: <http://localhost:3000/docs>
- **Postman Collection**: Available on request

### Support Channels

- **Email**: <api-support@copay.rw>
- **Documentation**: <https://docs.copay.rw>
- **Status Page**: <https://status.copay.rw>

### Common Issues & Solutions

1. **401 Unauthorized**: Check JWT token validity and format
2. **403 Forbidden**: Verify user role and cooperative access
3. **Payment Stuck**: Check mobile money USSD prompt completion
4. **Webhook Failures**: Verify signature and payload format
5. **Rate Limited**: Implement exponential backoff retry logic

### Development Tools

- **Swagger UI**: Interactive API testing
- **Webhook Testing**: Use ngrok for local webhook development
- **Database**: Prisma Studio for data inspection
- **Logs**: Application logs in JSON format

---

## Changelog & Versioning

### Version 1.0.0 (Current)

- **Authentication System**: JWT-based auth with role management
- **User Management**: Multi-tenant user operations
- **Payment Integration**: IremboPay gateway with mobile money & banks
- **Activity Tracking**: Comprehensive audit logging
- **Reminder System**: Automated notifications with multi-channel support
- **Public APIs**: Payment type endpoints without authentication
- **Webhook Support**: Real-time payment status updates

### Upcoming Features

- **Push Notifications**: Mobile app push notifications
- **Email Notifications**: SMTP integration for reminders
- **Advanced Analytics**: Payment and usage analytics
- **Bulk Operations**: Bulk user and payment management
- **API Versioning**: Backward-compatible API evolution

---

## Super Admin Tenant Management APIs

### Create Tenant (Super Admin Only)

- **POST** `/api/v1/users/tenants`
- **Auth**: Required (SUPER_ADMIN role)
- **Request Body**:

```json
{
  "phone": "+250788123456",
  "pin": "1234",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "cooperativeId": "507f1f77bcf86cd799439012",
  "notes": "Apartment 301, Building A"
}
```

- **Description**: Create a new tenant and assign them to a specific cooperative
- **Response**: Enhanced tenant details with statistics

### Get All Tenants (Super Admin Only)

- **GET** `/api/v1/users/tenants`
- **Auth**: Required (SUPER_ADMIN role)
- **Query Parameters**:
  - `page` (optional): Page number
  - `limit` (optional): Items per page
  - `search` (optional): Search in phone/name/email
  - `status` (optional): Filter by user status
  - `cooperativeId` (optional): Filter by cooperative
  - `dateFrom` (optional): Registration date range start
  - `dateTo` (optional): Registration date range end
  - `sortBy` (optional): Sort field
  - `sortOrder` (optional): asc/desc
- **Description**: Get paginated list of all tenants across all cooperatives with detailed information

### Get Tenant Statistics (Super Admin Only)

- **GET** `/api/v1/users/tenants/stats`
- **Auth**: Required (SUPER_ADMIN role)
- **Response**:

```json
{
  "total": 1250,
  "active": 1180,
  "inactive": 70,
  "byCooperative": [
    {
      "cooperativeId": "coop-1",
      "cooperativeName": "Kigali Housing Cooperative",
      "count": 450
    }
  ],
  "recentRegistrations": 25
}
```

### Get Tenant Details (Super Admin Only)

- **GET** `/api/v1/users/tenants/:id`
- **Auth**: Required (SUPER_ADMIN role)
- **Description**: Get detailed tenant information including payment stats and complaint history
- **Response**: Enhanced tenant details with:
  - Basic user information
  - Cooperative details
  - Payment statistics (total payments, amount, last payment)
  - Active complaints count

### Update Tenant (Super Admin Only)

- **PATCH** `/api/v1/users/tenants/:id`
- **Auth**: Required (SUPER_ADMIN role)
- **Request Body**:

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "status": "ACTIVE",
  "cooperativeId": "new-cooperative-id",
  "pin": "1234"
}
```

- **Description**: Update tenant information, move between cooperatives, reset PIN, or change status

### Delete Tenant (Super Admin Only)

- **DELETE** `/api/v1/users/tenants/:id`
- **Auth**: Required (SUPER_ADMIN role)
- **Description**:
  - Soft delete (set status to INACTIVE) if tenant has payment history
  - Hard delete if tenant has no payments
- **Response**: Confirmation message

### Tenant Management Features

- **Tenant Creation**: Create new tenants and assign them to any cooperative
- **Cross-Cooperative Access**: Super admins can manage tenants across all cooperatives
- **Enhanced Details**: Includes payment statistics and complaint counts
- **Flexible Filtering**: Filter by status, cooperative, registration date
- **Cooperative Migration**: Move tenants between cooperatives
- **PIN Reset**: Reset tenant PINs for account recovery
- **Smart Deletion**: Preserves data integrity for tenants with payment history

---

## Account Request Management APIs

### Create Account Request (Public)

- **POST** `/account-requests/:cooperativeId`
- **Auth**: None (Public endpoint)
- **Request Body**:

```json
{
  "fullName": "John Doe",
  "phone": "+250788123456",
  "roomNumber": "301"
}
```

- **Description**: Allow potential tenants to submit account requests to join a cooperative

### Get Account Requests (Role-based)

- **GET** `/account-requests`
- **Auth**: Required (SUPER_ADMIN, ORGANIZATION_ADMIN roles)
- **Query Parameters**:
  - `status` (optional): Filter by request status (PENDING, APPROVED, REJECTED)
  - `cooperativeId` (optional): Filter by cooperative (super admin only)
  - `page`, `limit` (optional): Pagination
- **Access Control**:
  - **Super Admin**: Can view all requests across all cooperatives
  - **Organization Admin**: Can only view requests for their cooperative
- **Description**: List account requests with role-based filtering

### Get Organization Account Requests (Organization Admin)

- **GET** `/organization/account-requests`
- **Auth**: Required (ORGANIZATION_ADMIN role)
- **Query Parameters**:
  - `status` (optional): Filter by request status
  - `page`, `limit` (optional): Pagination
- **Response**: Includes organization information along with requests
- **Description**: Dedicated endpoint for organization admins to view their cooperative's requests

### Get All Account Requests (Super Admin)

- **GET** `/admin/account-requests`
- **Auth**: Required (SUPER_ADMIN role)
- **Query Parameters**:
  - `cooperativeId` (optional): Filter by specific cooperative
  - `status` (optional): Filter by request status
  - `page`, `limit` (optional): Pagination
- **Description**: Super admin endpoint to view all account requests across all cooperatives

### Get Account Request Details

- **GET** `/account-requests/:id`
- **Auth**: Required (SUPER_ADMIN, ORGANIZATION_ADMIN roles)
- **Access Control**: Organization admins can only view requests from their cooperative
- **Description**: Get detailed information about a specific account request

### Process Account Request

- **PUT** `/account-requests/:id/process`
- **Auth**: Required (SUPER_ADMIN, ORGANIZATION_ADMIN roles)
- **Request Body**:

```json
{
  "action": "APPROVE",
  "notes": "Welcome to our cooperative",
  "rejectionReason": null
}
```

- **Actions**: APPROVE or REJECT
- **Description**: Approve or reject account requests. When approved, creates a new tenant user

### Delete Account Request

- **DELETE** `/account-requests/:id`
- **Auth**: Required (SUPER_ADMIN, ORGANIZATION_ADMIN roles)
- **Access Control**: Organization admins can only delete requests from their cooperative
- **Description**: Delete account request (admin only)

### Get Account Request Statistics

- **GET** `/account-requests/stats`
- **Auth**: Required (SUPER_ADMIN, ORGANIZATION_ADMIN roles)
- **Query Parameters**:
  - `cooperativeId` (optional): Filter statistics by cooperative (super admin only)
- **Response**:

```json
{
  "total": 45,
  "byStatus": [
    {"status": "PENDING", "count": 15},
    {"status": "APPROVED", "count": 25},
    {"status": "REJECTED", "count": 5}
  ],
  "recentRequests": [...]
}
```

- **Access Control**: Organization admins see only their cooperative's stats

### Check Availability

- **GET** `/account-requests/:cooperativeId/availability`
- **Auth**: None (Public endpoint)
- **Query Parameters**:
  - `phone` (optional): Check phone number availability
  - `roomNumber` (optional): Check room number availability
- **Description**: Check if phone number or room number is already in use (public endpoint)

### Account Request Management Features

- **Role-based Access Control**:
  - Super admins can manage requests across all cooperatives
  - Organization admins can only manage requests for their cooperative
- **Cooperative Isolation**: Each cooperative manages only their own account requests
- **Public Request Submission**: Anyone can submit account requests without authentication
- **Automated User Creation**: Approved requests automatically create tenant user accounts
- **Status Tracking**: Complete request lifecycle from submission to approval/rejection
- **Statistics Dashboard**: Role-based statistics for monitoring request volumes
- **Availability Checking**: Public endpoint to check phone/room availability before submission

---

*This documentation is maintained and updated with each API release. For the latest version, visit <https://docs.copay.rw/api>*
