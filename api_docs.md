# Copay Backend Server - Complete API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Authentication](#authentication)
4. [API Endpoints](#api-endpoints)
   - [Authentication Endpoints](#authentication-endpoints)
   - [User Management](#user-management)
   - [Account Requests](#account-requests)
   - [Cooperatives](#cooperatives)
   - [Payment Types (Public)](#payment-types-public)
   - [Payments](#payments)
   - [Activities](#activities)
   - [Reminders](#reminders)
   - [Complaints](#complaints)
   - [Notifications](#notifications)
   - [Announcements](#announcements)
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

### Health Check Endpoints

#### Root Health Check

**GET** `/` 🌍 *Public*

**Description:** Main health check endpoint for the application.

**Response:**

```json
{
  "message": "Copay API is running!",
  "timestamp": "2025-11-04T10:30:00Z",
  "version": "1.0.0"
}
```

#### Detailed Health Check

**GET** `/health` 🌍 *Public*

**Description:** Detailed health check with system status information.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-11-04T10:30:00Z",
  "environment": "development",
  "version": "1.0.0",
  "database": {
    "connected": true
  },
  "firebase": {
    "configured": true,
    "projectId": "copay-2be06"
  }
}
```

#### Configuration Check

**GET** `/health/config` 🌍 *Public*

**Description:** Configuration status check for debugging and monitoring.

**Response:**

```json
{
  "nodeEnv": "development",
  "port": 3000,
  "apiPrefix": "api/v1",
  "databaseUrl": "configured",
  "jwtSecret": "configured",
  "firebaseProjectId": "copay-2be06",
  "firebaseServiceAccount": "configured"
}
```

---

### USSD Integration Endpoints

#### Handle USSD Request

**POST** `/ussd` 🌍 *Public*

**Description:** Main USSD endpoint for telecom operator integration. Handles the complete USSD payment flow.

**Request Body:**

```json
{
  "sessionId": "session_12345678",
  "phoneNumber": "+250788123456",
  "text": "1",
  "serviceCode": "*134#",
  "networkCode": "MTN"
}
```

**Response:**

```json
{
  "message": "Welcome to Copay, John!\n\n1. Make Payment\n2. My Payments\n3. Help\n\nEnter your choice:",
  "sessionState": "CON"
}
```

**USSD Flow:**

1. **Welcome Menu**: Main options (Make Payment, My Payments, Help)
2. **Authentication**: PIN verification for secure access
3. **Payment Selection**: Choose payment type and amount
4. **Confirmation**: Review and confirm payment details
5. **Processing**: Initiate mobile money transaction
6. **Result**: Display success/failure message

**Session States:**

- `CON`: Continue session, expecting more input
- `END`: Terminate session, final message displayed

#### USSD Health Check

**POST** `/ussd/health` 🌍 *Public*

**Description:** Health check endpoint for telecom operators to verify USSD service availability.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-11-04T10:30:00Z",
  "service": "Copay USSD Gateway"
}
```

---

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

#### Get User Statistics

**GET** `/users/stats`

**Required Roles:** `SUPER_ADMIN`

**Description:** Get comprehensive user statistics across all roles and statuses.

**Response:**

```json
{
  "totalUsers": 1520,
  "totalTenants": 1250,
  "totalOrgAdmins": 15,
  "totalSuperAdmins": 3,
  "activeUsers": 1480,
  "inactiveUsers": 40,
  "recentRegistrations": 25
}
```

**Fields:**

- `totalUsers`: Total number of users across all roles
- `totalTenants`: Number of users with TENANT role
- `totalOrgAdmins`: Number of users with ORGANIZATION_ADMIN role
- `totalSuperAdmins`: Number of users with SUPER_ADMIN role
- `activeUsers`: Number of users with ACTIVE status
- `inactiveUsers`: Number of users with INACTIVE status
- `recentRegistrations`: Users registered in the last 30 days

---

## Account Request Management APIs

### Create Account Request (Public)

- **POST** `/account-requests`
- **Auth**: None (Public endpoint)
- **Request Body**:

```json
{
  "cooperativeId": "507f1f77bcf86cd799439012",
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

- **GET** `/account-requests/cooperative/:cooperativeId/check` 🌍 *Public*
- **Auth**: None (Public endpoint)
- **Query Parameters**:
  - `phone` (optional): Check phone number availability
  - `roomNumber` (optional): Check room number availability
- **Description**: Check if phone number or room number is already in use (public endpoint)

**Response:**

```json
{
  "phoneAvailable": true,
  "roomAvailable": true,
  "message": "Availability check completed"
}
```

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

#### Search Cooperatives

**GET** `/cooperatives/search`

**Description:** Advanced search for cooperatives with comprehensive filtering options including status, date range, and detailed search criteria.

**Query Parameters:**

- `search` (optional): Search by cooperative name, code, description, or address
- `status` (optional): Filter by cooperative status (`ACTIVE`, `INACTIVE`, `SUSPENDED`, `PENDING_APPROVAL`)
- `fromDate` (optional): Filter cooperatives created from this date
- `toDate` (optional): Filter cooperatives created until this date
- `sortBy` (optional): Sort field (`createdAt`, `name`, `code`, `status`)
- `sortOrder` (optional): Sort order (`asc`, `desc`)
- `page`, `limit` (pagination)

**Response:**

```json
{
  "data": [
    {
      "id": "507f1f77bcf86cd799439012",
      "name": "Nyamirambo Housing Cooperative",
      "code": "NHC001",
      "description": "A housing cooperative in Nyamirambo",
      "status": "ACTIVE",
      "address": "Nyamirambo, Kigali, Rwanda",
      "phone": "+250788111222",
      "email": "admin@nyamirambo.coop",
      "userCount": 45,
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3
  }
}
```

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

#### Search Payment Types

**GET** `/payment-types/search` 🔒 *Admin Only*

**Required Roles:** `ORGANIZATION_ADMIN`, `SUPER_ADMIN`

**Description:** Advanced search for payment types with comprehensive filtering options including cooperative, active status, amount type, and recurring settings.

**Query Parameters:**

- `search` (optional): Search by payment type name or description
- `cooperativeId` (optional): Filter by cooperative ID (super admin can search across cooperatives)
- `isActive` (optional): Filter by active status (`true`, `false`)
- `isRecurring` (optional): Filter by recurring payment types (`true`, `false`)
- `amountType` (optional): Filter by payment amount type (`FIXED`, `PARTIAL_ALLOWED`, `FLEXIBLE`)
- `fromDate` (optional): Filter payment types created from this date
- `toDate` (optional): Filter payment types created until this date
- `sortBy` (optional): Sort field (`createdAt`, `name`, `amount`, `dueDay`)
- `sortOrder` (optional): Sort order (`asc`, `desc`)
- `page`, `limit` (pagination)

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
      "isRecurring": true,
      "dueDay": 1,
      "cooperative": {
        "id": "507f1f77bcf86cd799439012",
        "name": "Nyamirambo Housing Cooperative",
        "code": "NHC001"
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "limit": 10,
    "totalPages": 2
  }
}
```

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

### Reminders

#### Search Reminders

**GET** `/reminders/search` 🔒 *Requires Auth*

**Required Roles:** `TENANT`, `ORGANIZATION_ADMIN`, `SUPER_ADMIN`

**Description:** Advanced search for reminders with comprehensive filtering options including type, status, payment type, and date ranges.

**Query Parameters:**

- `search` (optional): Search by reminder title, description, or notes
- `type` (optional): Filter by reminder type (`PAYMENT_DUE`, `CUSTOM`, `DEADLINE`)
- `status` (optional): Filter by reminder status (`ACTIVE`, `COMPLETED`, `CANCELLED`)
- `cooperativeId` (optional): Filter by cooperative ID (admin users only)
- `userId` (optional): Filter by user ID (admin users only)
- `paymentTypeId` (optional): Filter by payment type ID
- `isRecurring` (optional): Filter recurring reminders only (`true`, `false`)
- `fromDate` (optional): Filter reminders created from this date
- `toDate` (optional): Filter reminders created until this date
- `reminderFromDate` (optional): Filter reminders scheduled from this date
- `reminderToDate` (optional): Filter reminders scheduled until this date
- `sortBy` (optional): Sort field (`nextTrigger`, `reminderDate`, `createdAt`)
- `sortOrder` (optional): Sort order (`asc`, `desc`)
- `page`, `limit` (pagination)

**Response:**

```json
{
  "data": [
    {
      "id": "507f1f77bcf86cd799439017",
      "title": "Monthly Fee Reminder",
      "description": "Don't forget your monthly membership fee",
      "type": "PAYMENT_DUE",
      "status": "ACTIVE",
      "userId": "507f1f77bcf86cd799439013",
      "cooperativeId": "507f1f77bcf86cd799439011",
      "paymentTypeId": "507f1f77bcf86cd799439016",
      "paymentType": {
        "id": "507f1f77bcf86cd799439016",
        "name": "Monthly Membership Fee",
        "amount": 5000,
        "description": "Monthly membership dues"
      },
      "reminderDate": "2025-11-15T09:00:00Z",
      "isRecurring": true,
      "recurringPattern": "MONTHLY",
      "notificationTypes": ["SMS", "EMAIL"],
      "advanceNoticeDays": 3,
      "customAmount": null,
      "notes": null,
      "lastTriggered": null,
      "nextTrigger": "2025-11-12T09:00:00Z",
      "triggerCount": 0,
      "createdAt": "2025-01-01T10:00:00Z",
      "updatedAt": "2025-01-01T10:00:00Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

```bash
curl -X GET "https://api.copay.com/reminders/search?type=PAYMENT_DUE&status=ACTIVE&isRecurring=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
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
  "invoiceNumber": "INV_1729123456_abc123",
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

#### Search Payments

**GET** `/payments/search`

**Description:** Advanced search for payments with comprehensive filtering options including amount range, dates, status, payment methods, etc. Role-based access applies.

**Query Parameters:**

- `search` (optional): Search by payment description or reference
- `status` (optional): Filter by payment status (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`, `REFUNDED`)
- `paymentMethod` (optional): Filter by payment method (`MOBILE_MONEY_MTN`, `MOBILE_MONEY_AIRTEL`, `BANK_BK`, `BANK_IM`, `BANK_ECOBANK`)
- `cooperativeId` (optional): Filter by cooperative ID (admin only)
- `paymentTypeId` (optional): Filter by payment type ID
- `senderId` (optional): Filter by sender user ID (admin only)
- `minAmount` (optional): Minimum payment amount
- `maxAmount` (optional): Maximum payment amount
- `fromDate` (optional): Filter payments created from this date
- `toDate` (optional): Filter payments created until this date
- `paidFromDate` (optional): Filter payments paid from this date
- `paidToDate` (optional): Filter payments paid until this date
- `sortBy` (optional): Sort field (`createdAt`, `amount`, `paidAt`, `dueDate`)
- `sortOrder` (optional): Sort order (`asc`, `desc`)
- `page`, `limit` (pagination)

**Response:**

```json
{
  "data": [
    {
      "id": "67890abcdef12345",
      "amount": 50000,
      "status": "COMPLETED",
      "paymentMethod": "MOBILE_MONEY_MTN",
      "description": "Monthly rent payment for October 2025",
      "createdAt": "2025-10-16T10:30:00Z",
      "paidAt": "2025-10-16T10:32:00Z",
      "paymentType": {
        "id": "507f1f77bcf86cd799439011",
        "name": "Monthly Rent"
      },
      "sender": {
        "id": "507f1f77bcf86cd799439014",
        "firstName": "John",
        "lastName": "Doe"
      }
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 10,
    "totalPages": 15
  }
}
```

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

### Notifications

The Notifications API provides in-app notification management for users.

#### Get All Notifications

**GET** `/notifications`

**Required Roles:** `TENANT`, `ORGANIZATION_ADMIN`, `SUPER_ADMIN`

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `read` (optional): Filter by read status (true/false)

**Response:**

```json
{
  "data": [
    {
      "id": "507f1f77bcf86cd799439020",
      "title": "Payment Reminder",
      "message": "Your monthly payment of $500 is due tomorrow",
      "type": "PAYMENT_DUE",
      "isRead": false,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "readAt": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

#### Mark Notification as Read

**PATCH** `/notifications/:id/read`

**Required Roles:** `TENANT`, `ORGANIZATION_ADMIN`, `SUPER_ADMIN`

**Response:**

```json
{
  "id": "507f1f77bcf86cd799439020",
  "title": "Payment Reminder",
  "message": "Your monthly payment of $500 is due tomorrow",
  "type": "PAYMENT_DUE",
  "isRead": true,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "readAt": "2024-01-15T14:30:00.000Z"
}
```

#### Mark All Notifications as Read

**PATCH** `/notifications/mark-all-read`

**Required Roles:** `TENANT`, `ORGANIZATION_ADMIN`, `SUPER_ADMIN`

**Response:**

```json
{
  "message": "All notifications marked as read",
  "updatedCount": 15
}
```

---

### Announcements

The Announcements API enables role-based announcement creation and delivery with multi-channel notifications.

#### Create Announcement

**POST** `/announcements`

**Required Roles:** `SUPER_ADMIN`, `ORGANIZATION_ADMIN`

```json
{
  "title": "Emergency Maintenance Notice",
  "message": "Water will be shut off tomorrow from 9 AM to 2 PM for emergency pipe repairs in Building A.",
  "targetType": "SPECIFIC_COOPERATIVE",
  "targetCooperativeIds": ["507f1f77bcf86cd799439011"],
  "notificationTypes": ["IN_APP", "SMS"],
  "priority": "HIGH",
  "scheduledFor": "2024-01-20T08:00:00.000Z",
  "expiresAt": "2024-01-20T23:59:59.000Z"
}
```

**Fields:**

- `title` (required): Announcement title (3-200 characters)
- `message` (required): Announcement content (10-2000 characters)
- `targetType` (required): `ALL_TENANTS`, `ALL_ORGANIZATION_ADMINS`, `SPECIFIC_COOPERATIVE`, `SPECIFIC_USERS`
- `targetCooperativeIds` (conditional): Required for `SPECIFIC_COOPERATIVE` target type
- `targetUserIds` (conditional): Required for `SPECIFIC_USERS` target type
- `notificationTypes` (required): Array of notification channels
- `priority` (optional): `LOW`, `MEDIUM`, `HIGH`, `URGENT` (default: MEDIUM)
- `scheduledFor` (optional): ISO 8601 timestamp for scheduled delivery
- `expiresAt` (optional): ISO 8601 timestamp for announcement expiration

**Notification Channel Restrictions:**

- **Tenants**: Can receive `IN_APP`, `PUSH_NOTIFICATION`, `SMS`
- **Organization Admins**: Can receive `IN_APP`, `SMS`
- **Super Admins**: Can receive all notification types

**Access Control:**

- **Organization Admins**: Can only target tenants in their cooperative
- **Super Admins**: Can target any audience across all cooperatives

**Response:**

```json
{
  "id": "507f1f77bcf86cd799439025",
  "title": "Emergency Maintenance Notice",
  "message": "Water will be shut off tomorrow from 9 AM to 2 PM...",
  "targetType": "SPECIFIC_COOPERATIVE",
  "targetCooperativeIds": ["507f1f77bcf86cd799439011"],
  "notificationTypes": ["IN_APP", "SMS"],
  "priority": "HIGH",
  "status": "DRAFT",
  "scheduledFor": "2024-01-20T08:00:00.000Z",
  "expiresAt": "2024-01-20T23:59:59.000Z",
  "estimatedRecipientsCount": 125,
  "createdBy": {
    "id": "507f1f77bcf86cd799439010",
    "name": "John Admin",
    "role": "ORGANIZATION_ADMIN"
  },
  "cooperative": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Green Valley Cooperative"
  },
  "createdAt": "2024-01-19T15:30:00.000Z",
  "updatedAt": "2024-01-19T15:30:00.000Z"
}
```

#### Get All Announcements

**GET** `/announcements`

**Required Roles:** `SUPER_ADMIN`, `ORGANIZATION_ADMIN`

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `status` (optional): Filter by status (`DRAFT`, `SCHEDULED`, `SENDING`, `SENT`, `CANCELLED`)
- `search` (optional): Search in title and message
- `sortBy` (optional): Sort field (default: createdAt)
- `sortOrder` (optional): Sort direction (asc/desc, default: desc)

**Access Control:**

- **Organization Admins**: See only their cooperative's announcements
- **Super Admins**: See all announcements across cooperatives

**Response:**

```json
{
  "data": [
    {
      "id": "507f1f77bcf86cd799439025",
      "title": "Emergency Maintenance Notice",
      "targetType": "SPECIFIC_COOPERATIVE",
      "priority": "HIGH",
      "status": "SCHEDULED",
      "scheduledFor": "2024-01-20T08:00:00.000Z",
      "estimatedRecipientsCount": 125,
      "createdBy": {
        "id": "507f1f77bcf86cd799439010",
        "name": "John Admin",
        "role": "ORGANIZATION_ADMIN"
      },
      "createdAt": "2024-01-19T15:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "totalPages": 2
  }
}
```

#### Get Announcement Statistics

**GET** `/announcements/stats`

**Required Roles:** `SUPER_ADMIN`, `ORGANIZATION_ADMIN`

**Response:**

```json
{
  "totalAnnouncements": 45,
  "statusBreakdown": {
    "DRAFT": 5,
    "SCHEDULED": 3,
    "SENT": 35,
    "CANCELLED": 2
  },
  "priorityBreakdown": {
    "LOW": 10,
    "MEDIUM": 25,
    "HIGH": 8,
    "URGENT": 2
  },
  "totalRecipientsReached": 1250,
  "last30Days": {
    "announcementsSent": 12,
    "recipientsReached": 480
  }
}
```

#### Get Announcement by ID

**GET** `/announcements/:id`

**Required Roles:** `SUPER_ADMIN`, `ORGANIZATION_ADMIN`

**Response:**

```json
{
  "id": "507f1f77bcf86cd799439025",
  "title": "Emergency Maintenance Notice",
  "message": "Water will be shut off tomorrow from 9 AM to 2 PM for emergency pipe repairs in Building A. Please prepare by storing water for essential needs.",
  "targetType": "SPECIFIC_COOPERATIVE",
  "targetCooperativeIds": ["507f1f77bcf86cd799439011"],
  "notificationTypes": ["IN_APP", "SMS"],
  "priority": "HIGH",
  "status": "SENT",
  "scheduledFor": "2024-01-20T08:00:00.000Z",
  "sentAt": "2024-01-20T08:00:15.000Z",
  "expiresAt": "2024-01-20T23:59:59.000Z",
  "estimatedRecipientsCount": 125,
  "actualRecipientsCount": 123,
  "deliveryStats": {
    "IN_APP": {
      "sent": 123,
      "delivered": 123,
      "failed": 0
    },
    "SMS": {
      "sent": 123,
      "delivered": 120,
      "failed": 3
    }
  },
  "createdBy": {
    "id": "507f1f77bcf86cd799439010",
    "name": "John Admin",
    "role": "ORGANIZATION_ADMIN"
  },
  "cooperative": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Green Valley Cooperative"
  },
  "createdAt": "2024-01-19T15:30:00.000Z",
  "updatedAt": "2024-01-20T08:00:15.000Z"
}
```

#### Update Announcement

**PUT** `/announcements/:id`

**Required Roles:** `SUPER_ADMIN`, `ORGANIZATION_ADMIN`

**Note:** Only `DRAFT` and `SCHEDULED` announcements can be updated.

```json
{
  "title": "Updated: Emergency Maintenance Notice",
  "message": "Water will be shut off tomorrow from 10 AM to 3 PM (updated time) for emergency pipe repairs.",
  "priority": "URGENT",
  "scheduledFor": "2024-01-20T09:00:00.000Z"
}
```

**Response:** Same format as Get Announcement by ID

#### Delete Announcement

**DELETE** `/announcements/:id`

**Required Roles:** `SUPER_ADMIN`, `ORGANIZATION_ADMIN`

**Note:** Only `DRAFT` and `SCHEDULED` announcements can be deleted.

**Response:** `204 No Content`

#### Send Announcement Immediately

**POST** `/announcements/:id/send`

**Required Roles:** `SUPER_ADMIN`, `ORGANIZATION_ADMIN`

**Description:** Send a `DRAFT` or `SCHEDULED` announcement immediately, bypassing the scheduled time.

**Response:**

```json
{
  "message": "Announcement sent successfully"
}
```

**Targeting Examples:**

```json
// Target all tenants (org admin: only in their cooperative)
{
  "targetType": "ALL_TENANTS",
  "notificationTypes": ["IN_APP", "PUSH_NOTIFICATION"]
}

// Target all organization admins (super admin only)
{
  "targetType": "ALL_ORGANIZATION_ADMINS",
  "notificationTypes": ["IN_APP", "SMS"]
}

// Target specific cooperatives
{
  "targetType": "SPECIFIC_COOPERATIVE",
  "targetCooperativeIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
  "notificationTypes": ["IN_APP", "SMS"]
}

// Target specific users
{
  "targetType": "SPECIFIC_USERS",
  "targetUserIds": ["507f1f77bcf86cd799439020", "507f1f77bcf86cd799439021"],
  "notificationTypes": ["IN_APP"]
}
```

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

#### Test Webhook (Development)

**POST** `/webhooks/payments/test` 🌍 *Public*

**Description:** Test endpoint for webhook functionality during development. Does not require signature verification.

**Request Body:**

```json
{
  "gatewayTransactionId": "TEST_TXN_123456",
  "status": "COMPLETED",
  "gatewayReference": "TEST_REF_789",
  "failureReason": null,
  "gatewayData": {
    "test": true,
    "amount": 50000
  },
  "signature": "test_signature"
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Test webhook processed successfully"
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

## API Documentation Audit Summary

I've completed a comprehensive audit of your APIs and documentation. Here's what I found and implemented:

### ✅ Previously Undocumented APIs Now Added

1. **Health Check Endpoints**:
   - `GET /` - Root health check
   - `GET /health` - Detailed health with system status  
   - `GET /health/config` - Configuration status check

2. **USSD Integration Endpoints**:
   - `POST /ussd` - Main USSD handler for telecom integration
   - `POST /ussd/health` - USSD service health check

3. **Additional Webhook Endpoints**:
   - `POST /webhooks/payments/test` - Test webhook for development

4. **Account Request Route Corrections**:
   - Fixed routing inconsistencies in account request endpoints
   - Added proper availability checking endpoint

### ✅ Missing Implementation Created

1. **Notification Controller** - The notification endpoints were documented but the controller didn't exist:
   - ✅ Created `NotificationController` with proper endpoints
   - ✅ Added DTOs for notification responses  
   - ✅ Updated `NotificationModule` to include the controller
   - ✅ Implemented `GET /notifications/in-app` and `PATCH /notifications/in-app/:id/read`

### 📊 Complete API Coverage

**Total: 63+ documented API endpoints** across 12 modules, all properly documented with:

- Complete request/response examples
- Authentication requirements
- Role-based access control information
- Query parameters and path parameters
- Error response codes
- Integration examples

---

*This documentation is maintained and updated with each API release. For the latest version, visit <https://docs.copay.rw/api>*
