# Reminder API Documentation

## Overview

The Reminder API provides comprehensive payment reminder functionality for tenants in the Copay backend system. This API allows users to create, manage, and receive automated payment reminders with multi-channel notification support.

## Base URL
```
/api/reminders
```

## Authentication
All endpoints require Bearer token authentication.

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Create Reminder

**POST** `/reminders`

Creates a new payment reminder with notification preferences.

**Required Roles:** `TENANT`, `ORGANIZATION_ADMIN`, `SUPER_ADMIN`

**Request Body:**
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

**Response:**
```json
{
  "id": "clm3kj5k3000201h5b1c2d3e4",
  "title": "Monthly Rent Payment",
  "description": "Remember to pay rent before the due date",
  "type": "PAYMENT_DUE",
  "status": "ACTIVE",
  "userId": "clm3kj5k3000201h5b1c2d3e2",
  "paymentTypeId": "clm3kj5k3000201h5b1c2d3e4",
  "reminderDate": "2025-11-01T09:00:00Z",
  "isRecurring": true,
  "recurringPattern": "MONTHLY",
  "notificationTypes": ["SMS", "IN_APP"],
  "advanceNoticeDays": 3,
  "customAmount": 50000,
  "notes": "Don't forget to include the reference number",
  "createdAt": "2025-10-24T10:00:00Z",
  "updatedAt": "2025-10-24T10:00:00Z"
}
```

### 2. Get All Reminders

**GET** `/reminders`

Retrieves reminders with filtering and pagination based on user role.

**Required Roles:** `TENANT`, `ORGANIZATION_ADMIN`, `SUPER_ADMIN`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `search` (optional): Search query
- `sortBy` (optional): Sort field
- `sortOrder` (optional): Sort direction (`asc` | `desc`)
- `type` (optional): Filter by reminder type (`PAYMENT_DUE` | `PAYMENT_OVERDUE` | `CUSTOM`)
- `status` (optional): Filter by status (`ACTIVE` | `PAUSED` | `COMPLETED` | `CANCELLED`)
- `paymentTypeId` (optional): Filter by payment type ID
- `fromDate` (optional): Filter reminders from date (ISO 8601)
- `toDate` (optional): Filter reminders to date (ISO 8601)
- `isRecurring` (optional): Filter recurring reminders (boolean)
- `isDue` (optional): Filter due reminders (boolean)

**Example Request:**
```
GET /reminders?page=1&limit=10&type=PAYMENT_DUE&status=ACTIVE&isRecurring=true
```

**Response:**
```json
{
  "items": [
    {
      "id": "clm3kj5k3000201h5b1c2d3e4",
      "title": "Monthly Rent Payment",
      "type": "PAYMENT_DUE",
      "status": "ACTIVE",
      "reminderDate": "2025-11-01T09:00:00Z",
      "isRecurring": true,
      "recurringPattern": "MONTHLY"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 3. Get Current User Reminders

**GET** `/reminders/me`

Retrieves reminders for the authenticated user only.

**Query Parameters:** Same as "Get All Reminders"

**Response:** Same format as "Get All Reminders"

### 4. Get Due Reminders

**GET** `/reminders/due`

Retrieves reminders that are due now or overdue.

**Required Roles:** `TENANT`, `ORGANIZATION_ADMIN`, `SUPER_ADMIN`

**Query Parameters:** Same as "Get All Reminders" (automatically filters `isDue=true`)

**Response:** Same format as "Get All Reminders"

### 5. Get Reminder by ID

**GET** `/reminders/{id}`

Retrieves a specific reminder by ID.

**Required Roles:** `TENANT`, `ORGANIZATION_ADMIN`, `SUPER_ADMIN`

**Path Parameters:**
- `id`: Reminder ID

**Response:**
```json
{
  "id": "clm3kj5k3000201h5b1c2d3e4",
  "title": "Monthly Rent Payment",
  "description": "Remember to pay rent before the due date",
  "type": "PAYMENT_DUE",
  "status": "ACTIVE",
  "userId": "clm3kj5k3000201h5b1c2d3e2",
  "paymentTypeId": "clm3kj5k3000201h5b1c2d3e4",
  "reminderDate": "2025-11-01T09:00:00Z",
  "isRecurring": true,
  "recurringPattern": "MONTHLY",
  "notificationTypes": ["SMS", "IN_APP"],
  "advanceNoticeDays": 3,
  "customAmount": 50000,
  "notes": "Don't forget to include the reference number",
  "createdAt": "2025-10-24T10:00:00Z",
  "updatedAt": "2025-10-24T10:00:00Z"
}
```

### 6. Update Reminder

**PUT** `/reminders/{id}`

Updates an existing reminder.

**Required Roles:** `TENANT`, `ORGANIZATION_ADMIN`, `SUPER_ADMIN`

**Path Parameters:**
- `id`: Reminder ID

**Request Body:** Same fields as Create Reminder (all optional)

**Response:** Same format as Get Reminder by ID

### 7. Delete Reminder

**DELETE** `/reminders/{id}`

Deletes an existing reminder.

**Required Roles:** `TENANT`, `ORGANIZATION_ADMIN`, `SUPER_ADMIN`

**Path Parameters:**
- `id`: Reminder ID

**Response:** 204 No Content

## Data Models

### ReminderType Enum
- `PAYMENT_DUE`: Standard payment due reminder
- `PAYMENT_OVERDUE`: Overdue payment reminder
- `CUSTOM`: Custom reminder type

### ReminderStatus Enum
- `ACTIVE`: Reminder is active and will trigger
- `PAUSED`: Reminder is temporarily paused
- `COMPLETED`: Reminder has been completed
- `CANCELLED`: Reminder has been cancelled

### NotificationType Enum
- `SMS`: SMS notification
- `EMAIL`: Email notification (if configured)
- `IN_APP`: In-app notification
- `PUSH`: Push notification (if configured)

### RecurringPattern Options
- `DAILY`: Daily recurrence
- `WEEKLY`: Weekly recurrence
- `MONTHLY`: Monthly recurrence
- `YEARLY`: Yearly recurrence

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Reminder not found",
  "error": "Not Found"
}
```

## Role-Based Access Control

### TENANT
- Can create, read, update, and delete their own reminders only
- Cannot access other users' reminders

### ORGANIZATION_ADMIN
- Can manage reminders for all users within their cooperative
- Cannot access reminders from other cooperatives

### SUPER_ADMIN
- Can manage all reminders across all cooperatives
- Full access to all reminder data

## Usage Examples

### Creating a Monthly Rent Reminder
```bash
curl -X POST /api/reminders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Monthly Rent Payment",
    "type": "PAYMENT_DUE",
    "paymentTypeId": "rent-payment-type-id",
    "reminderDate": "2025-11-01T09:00:00Z",
    "isRecurring": true,
    "recurringPattern": "MONTHLY",
    "notificationTypes": ["SMS", "IN_APP"],
    "advanceNoticeDays": 3
  }'
```

### Getting Due Reminders
```bash
curl -X GET "/api/reminders/due?page=1&limit=10" \
  -H "Authorization: Bearer <token>"
```

### Updating a Reminder Status
```bash
curl -X PUT /api/reminders/reminder-id \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PAUSED"
  }'
```

## Notification System

When reminders are due, the system automatically:

1. **Checks for due reminders** every minute via cron job
2. **Sends notifications** via configured channels (SMS, email, in-app, push)
3. **Creates notification records** for tracking delivery status
4. **Handles recurring patterns** by creating next reminder instances
5. **Updates reminder status** based on completion or failure

### SMS Notifications
SMS notifications are sent using the integrated SMS service with the following format:
```
Reminder: [Title]
Due: [Date]
Amount: [Amount] (if applicable)
[Notes] (if provided)
```

### Notification Tracking
All notifications are tracked with:
- Delivery status (pending, sent, failed, read)
- Provider response data
- Timestamps for sent/delivered/read events
- Error messages for failed deliveries