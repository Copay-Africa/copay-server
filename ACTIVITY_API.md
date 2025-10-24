# Activity API Documentation

## Overview

The Activity API provides comprehensive user activity tracking and audit logging functionality for the Copay backend system. This API allows monitoring of user actions, security events, and system activities with role-based access control.

## Base URL
```
/api/activities
```

## Authentication
All endpoints require Bearer token authentication.

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Create Activity

**POST** `/activities`

Manually creates an activity record (typically used by system processes).

**Request Body:**
```json
{
  "type": "LOGIN",
  "description": "User logged in successfully",
  "entityType": "USER",
  "entityId": "clm3kj5k3000201h5b1c2d3e2",
  "metadata": {
    "loginMethod": "credentials",
    "deviceType": "mobile"
  },
  "isSecurityEvent": false
}
```

**Response:**
```json
{
  "id": "clm3kj5k3000201h5b1c2d3e5",
  "type": "LOGIN",
  "description": "User logged in successfully",
  "entityType": "USER",
  "entityId": "clm3kj5k3000201h5b1c2d3e2",
  "userId": "clm3kj5k3000201h5b1c2d3e2",
  "cooperativeId": "clm3kj5k3000201h5b1c2d3e1",
  "metadata": {
    "loginMethod": "credentials",
    "deviceType": "mobile"
  },
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "isSecurityEvent": false,
  "createdAt": "2025-10-24T10:00:00Z"
}
```

### 2. Get All Activities

**GET** `/activities`

Retrieves activities with filtering and pagination based on user role.

**Required Roles:** `SUPER_ADMIN`, `ORGANIZATION_ADMIN`, `TENANT`

**Access Control:**
- **TENANT**: See only their own activities
- **ORGANIZATION_ADMIN**: See activities within their cooperative
- **SUPER_ADMIN**: See all activities across all cooperatives

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `search` (optional): Search query
- `sortBy` (optional): Sort field
- `sortOrder` (optional): Sort direction (`asc` | `desc`)
- `type` (optional): Filter by activity type
- `entityType` (optional): Filter by entity type (`USER` | `PAYMENT` | `COOPERATIVE` | `REMINDER` | `SYSTEM`)
- `entityId` (optional): Filter by specific entity ID
- `userId` (optional): Filter by user ID (admin access required)
- `cooperativeId` (optional): Filter by cooperative ID (super admin access required)
- `fromDate` (optional): Filter activities from date (ISO 8601)
- `toDate` (optional): Filter activities to date (ISO 8601)
- `isSecurityEvent` (optional): Filter security events only (boolean)

**Example Request:**
```
GET /activities?page=1&limit=10&type=PAYMENT_CREATED&isSecurityEvent=false&fromDate=2025-10-01T00:00:00Z
```

**Response:**
```json
{
  "items": [
    {
      "id": "clm3kj5k3000201h5b1c2d3e5",
      "type": "PAYMENT_CREATED",
      "description": "Payment created for rent",
      "entityType": "PAYMENT",
      "entityId": "clm3kj5k3000201h5b1c2d3e6",
      "userId": "clm3kj5k3000201h5b1c2d3e2",
      "cooperativeId": "clm3kj5k3000201h5b1c2d3e1",
      "metadata": {
        "amount": 50000,
        "paymentType": "rent"
      },
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "isSecurityEvent": false,
      "createdAt": "2025-10-24T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "pages": 15,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 3. Get Current User Activities

**GET** `/activities/me`

Retrieves activities for the authenticated user only.

**Query Parameters:** Same as "Get All Activities" (user-specific filtering applied automatically)

**Response:** Same format as "Get All Activities"

### 4. Get Security Activities

**GET** `/activities/security`

Retrieves only security-related activities and events.

**Required Roles:** `SUPER_ADMIN`, `ORGANIZATION_ADMIN`

**Query Parameters:** Same as "Get All Activities" (automatically filters `isSecurityEvent=true`)

**Response:** Same format as "Get All Activities"

## Activity Types

The system automatically tracks various activity types:

### Authentication Activities
- `LOGIN`: User successful login
- `LOGOUT`: User logout
- `LOGIN_FAILED`: Failed login attempt
- `PASSWORD_RESET`: Password reset initiated
- `PASSWORD_CHANGED`: Password successfully changed
- `ACCOUNT_LOCKED`: Account locked due to security
- `ACCOUNT_UNLOCKED`: Account unlocked by admin

### Payment Activities
- `PAYMENT_CREATED`: New payment initiated
- `PAYMENT_COMPLETED`: Payment successfully completed
- `PAYMENT_FAILED`: Payment failed
- `PAYMENT_CANCELLED`: Payment cancelled by user
- `PAYMENT_REFUNDED`: Payment refunded

### User Management Activities
- `USER_CREATED`: New user account created
- `USER_UPDATED`: User profile updated
- `USER_DELETED`: User account deleted
- `USER_ROLE_CHANGED`: User role modified
- `USER_STATUS_CHANGED`: User status changed

### Cooperative Activities
- `COOPERATIVE_CREATED`: New cooperative created
- `COOPERATIVE_UPDATED`: Cooperative details updated
- `COOPERATIVE_DELETED`: Cooperative deleted
- `USER_JOINED_COOPERATIVE`: User joined cooperative
- `USER_LEFT_COOPERATIVE`: User left cooperative

### Reminder Activities
- `REMINDER_CREATED`: New reminder created
- `REMINDER_UPDATED`: Reminder modified
- `REMINDER_DELETED`: Reminder deleted
- `REMINDER_TRIGGERED`: Reminder notification sent
- `NOTIFICATION_SENT`: Notification successfully sent
- `NOTIFICATION_FAILED`: Notification delivery failed

### System Activities
- `SYSTEM_STARTUP`: Application started
- `SYSTEM_SHUTDOWN`: Application shutdown
- `DATABASE_BACKUP`: Database backup created
- `CONFIGURATION_CHANGED`: System configuration modified

### Security Events
- `SUSPICIOUS_LOGIN`: Login from unusual location/device
- `MULTIPLE_FAILED_LOGINS`: Multiple failed login attempts
- `UNAUTHORIZED_ACCESS`: Attempted unauthorized access
- `PRIVILEGE_ESCALATION`: Attempted privilege escalation
- `DATA_EXPORT`: Sensitive data exported
- `ADMIN_ACTION`: Administrative action performed

## Entity Types

Activities can be associated with different entity types:

- `USER`: User-related activities
- `PAYMENT`: Payment-related activities
- `COOPERATIVE`: Cooperative-related activities
- `REMINDER`: Reminder-related activities
- `SYSTEM`: System-level activities

## Automatic Activity Logging

The system automatically logs activities in the following scenarios:

### 1. Authentication Events
```typescript
// Automatically logged when user logs in
{
  type: 'LOGIN',
  description: 'User logged in successfully',
  entityType: 'USER',
  entityId: userId,
  metadata: {
    loginMethod: 'credentials',
    deviceType: 'detected from user-agent'
  },
  isSecurityEvent: false
}
```

### 2. Payment Events
```typescript
// Automatically logged when payment is created
{
  type: 'PAYMENT_CREATED',
  description: 'Payment created for [payment type]',
  entityType: 'PAYMENT',
  entityId: paymentId,
  metadata: {
    amount: paymentAmount,
    paymentType: paymentTypeName,
    cooperativeId: targetCooperativeId
  },
  isSecurityEvent: false
}
```

### 3. Security Events
```typescript
// Automatically logged for suspicious activities
{
  type: 'SUSPICIOUS_LOGIN',
  description: 'Login from new device/location',
  entityType: 'USER',
  entityId: userId,
  metadata: {
    previousLocation: 'Last known location',
    currentLocation: 'Current location',
    deviceInfo: 'Device information'
  },
  isSecurityEvent: true
}
```

## Data Models

### Activity Schema
```typescript
{
  id: string;              // Unique activity ID
  type: ActivityType;      // Type of activity (enum)
  description: string;     // Human-readable description
  entityType: EntityType;  // Type of entity involved
  entityId: string;        // ID of the entity
  userId: string;          // ID of user who performed the action
  cooperativeId?: string;  // Associated cooperative ID
  metadata?: object;       // Additional activity data
  ipAddress?: string;      // IP address of the request
  userAgent?: string;      // User agent string
  isSecurityEvent: boolean;// Whether this is a security-related event
  createdAt: Date;         // Timestamp of the activity
}
```

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

## Role-Based Access Control

### TENANT
- Can view only their own activities
- Cannot view other users' activities
- Cannot view system-level activities
- Cannot access security events

### ORGANIZATION_ADMIN
- Can view activities for all users within their cooperative
- Can view cooperative-level activities
- Can access security events for their cooperative
- Cannot view activities from other cooperatives

### SUPER_ADMIN
- Can view all activities across all cooperatives
- Full access to security events
- Can view system-level activities
- Can filter by any user or cooperative

## Usage Examples

### Getting User Activities
```bash
curl -X GET "/api/activities/me?page=1&limit=20&type=PAYMENT_CREATED" \
  -H "Authorization: Bearer <token>"
```

### Getting Security Events (Admin)
```bash
curl -X GET "/api/activities/security?fromDate=2025-10-01T00:00:00Z" \
  -H "Authorization: Bearer <token>"
```

### Creating Manual Activity (System Use)
```bash
curl -X POST /api/activities \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SYSTEM_MAINTENANCE",
    "description": "System maintenance performed",
    "entityType": "SYSTEM",
    "entityId": "maintenance-task-1",
    "metadata": {
      "maintenanceType": "database_cleanup",
      "duration": "30 minutes"
    },
    "isSecurityEvent": false
  }'
```

### Filtering Payment Activities
```bash
curl -X GET "/api/activities?entityType=PAYMENT&type=PAYMENT_COMPLETED&fromDate=2025-10-01T00:00:00Z&toDate=2025-10-31T23:59:59Z" \
  -H "Authorization: Bearer <token>"
```

## Integration with Other Modules

### Authentication Module
- Automatically logs login/logout events
- Tracks failed authentication attempts
- Monitors suspicious login patterns

### Payment Module
- Logs all payment lifecycle events
- Tracks payment method changes
- Records refund and cancellation activities

### Reminder Module
- Logs reminder creation and modifications
- Tracks notification delivery status
- Records user interactions with reminders

### User Module
- Logs profile updates
- Tracks role changes
- Records account status modifications

## Audit Trail

The Activity API serves as a comprehensive audit trail providing:

1. **User Actions**: Complete history of user interactions
2. **System Changes**: Record of all system modifications
3. **Security Monitoring**: Detection and logging of security events
4. **Compliance**: Audit trail for regulatory compliance
5. **Debugging**: Detailed logs for troubleshooting issues

## Retention Policy

- **Regular Activities**: Retained for 1 year
- **Security Events**: Retained for 3 years
- **Payment Activities**: Retained for 7 years (compliance)
- **System Activities**: Retained for 90 days

## Performance Considerations

- Activities are indexed by `userId`, `cooperativeId`, `createdAt`, and `type`
- Large date ranges may require pagination
- Security events are prioritized for faster retrieval
- Metadata searching may be slower for large datasets