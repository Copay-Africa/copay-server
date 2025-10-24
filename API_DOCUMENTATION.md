# Copay Backend API Documentation

## Overview

This document provides comprehensive API documentation for the Copay backend system, focusing on the Activity and Reminder modules that provide user activity tracking and payment reminder functionality.

## Table of Contents

1. [Authentication](#authentication)
2. [Activity API](#activity-api)
3. [Reminder API](#reminder-api)
4. [Common Data Models](#common-data-models)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)

## Authentication

All API endpoints require JWT Bearer token authentication.

**Header Format:**
```
Authorization: Bearer <your-jwt-token>
```

**Token Acquisition:**
Tokens are obtained through the authentication endpoints (see Auth API documentation).

## Activity API

### Base URL: `/api/activities`

The Activity API provides comprehensive user activity tracking and audit logging functionality.

#### Key Features
- **Automatic Activity Logging**: System automatically tracks user actions
- **Role-Based Access Control**: Different access levels based on user roles
- **Security Event Monitoring**: Special handling for security-related activities
- **Comprehensive Audit Trail**: Full history of system interactions

#### Main Endpoints

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/activities` | Get all activities (filtered by role) | TENANT, ORGANIZATION_ADMIN, SUPER_ADMIN |
| GET | `/activities/me` | Get current user activities | All authenticated users |
| GET | `/activities/security` | Get security events only | ORGANIZATION_ADMIN, SUPER_ADMIN |
| POST | `/activities` | Create activity record | System/Admin use |

#### Activity Types Tracked

**Authentication Events:**
- Login/logout activities
- Failed authentication attempts  
- Password changes
- Account security events

**Payment Events:**
- Payment creation, completion, failure
- Payment cancellations and refunds
- Cross-cooperative payment activities

**User Management:**
- Profile updates
- Role changes
- Account status modifications

**Security Events:**
- Suspicious login attempts
- Unauthorized access attempts
- Data export activities
- Administrative actions

#### Role-Based Access
- **TENANT**: Own activities only
- **ORGANIZATION_ADMIN**: Cooperative-wide activities
- **SUPER_ADMIN**: All activities across cooperatives

## Reminder API

### Base URL: `/api/reminders`

The Reminder API provides comprehensive payment reminder functionality with multi-channel notification support.

#### Key Features
- **Automated Reminders**: Scheduled payment reminders
- **Multi-Channel Notifications**: SMS, email, in-app, push notifications
- **Recurring Patterns**: Support for daily, weekly, monthly, yearly recurrence
- **Advanced Notice**: Configurable advance notification periods
- **Cross-Cooperative Support**: Reminders for payments across different cooperatives

#### Main Endpoints

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `/reminders` | Create new reminder | TENANT, ORGANIZATION_ADMIN, SUPER_ADMIN |
| GET | `/reminders` | Get all reminders (filtered by role) | TENANT, ORGANIZATION_ADMIN, SUPER_ADMIN |
| GET | `/reminders/me` | Get current user reminders | All authenticated users |
| GET | `/reminders/due` | Get due/overdue reminders | TENANT, ORGANIZATION_ADMIN, SUPER_ADMIN |
| GET | `/reminders/{id}` | Get specific reminder | TENANT, ORGANIZATION_ADMIN, SUPER_ADMIN |
| PUT | `/reminders/{id}` | Update reminder | TENANT, ORGANIZATION_ADMIN, SUPER_ADMIN |
| DELETE | `/reminders/{id}` | Delete reminder | TENANT, ORGANIZATION_ADMIN, SUPER_ADMIN |

#### Reminder Types
- **PAYMENT_DUE**: Standard payment due reminder
- **PAYMENT_OVERDUE**: Overdue payment reminder  
- **CUSTOM**: Custom reminder type

#### Notification Channels
- **SMS**: Text message notifications
- **EMAIL**: Email notifications (if configured)
- **IN_APP**: In-application notifications
- **PUSH**: Push notifications (if configured)

#### Recurring Patterns
- **DAILY**: Daily recurrence
- **WEEKLY**: Weekly recurrence
- **MONTHLY**: Monthly recurrence
- **YEARLY**: Yearly recurrence

## Common Data Models

### Pagination Response
```json
{
  "items": [...],
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

### Standard Query Parameters
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)
- `search`: Search query
- `sortBy`: Sort field
- `sortOrder`: Sort direction (`asc` | `desc`)
- `fromDate`: Start date filter (ISO 8601)
- `toDate`: End date filter (ISO 8601)

### User Roles
- **TENANT**: Regular user with basic permissions
- **ORGANIZATION_ADMIN**: Administrative access within cooperative
- **SUPER_ADMIN**: Full system access across all cooperatives

## Error Handling

### Standard Error Response Format
```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Error Type",
  "details": {...} // Optional additional details
}
```

### Common HTTP Status Codes
- **200**: Success
- **201**: Created successfully
- **204**: No content (successful deletion)
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (authentication required)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found (resource doesn't exist)
- **429**: Too Many Requests (rate limit exceeded)
- **500**: Internal Server Error

### Validation Errors
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    {
      "field": "reminderDate",
      "message": "reminderDate must be a valid ISO 8601 date string"
    }
  ]
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Short-term**: 3 requests per second
- **Medium-term**: 20 requests per 10 seconds  
- **Long-term**: 100 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Integration Examples

### Creating a Payment Reminder with Activity Logging

1. **Create Reminder** (automatically logged as activity):
```bash
curl -X POST /api/reminders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Monthly Rent Payment",
    "type": "PAYMENT_DUE",
    "reminderDate": "2025-11-01T09:00:00Z",
    "notificationTypes": ["SMS", "IN_APP"]
  }'
```

2. **Check Activities** to see the creation logged:
```bash
curl -X GET "/api/activities/me?type=REMINDER_CREATED" \
  -H "Authorization: Bearer <token>"
```

### Monitoring Security Events

1. **Get Security Activities** (Admin only):
```bash
curl -X GET "/api/activities/security?fromDate=2025-10-01T00:00:00Z" \
  -H "Authorization: Bearer <token>"
```

2. **Filter Suspicious Activities**:
```bash
curl -X GET "/api/activities?isSecurityEvent=true&type=SUSPICIOUS_LOGIN" \
  -H "Authorization: Bearer <token>"
```

## Data Retention Policies

### Activity Data
- **Regular Activities**: 1 year retention
- **Security Events**: 3 years retention
- **Payment Activities**: 7 years retention (compliance)
- **System Activities**: 90 days retention

### Reminder Data
- **Active Reminders**: Retained until cancelled/completed
- **Completed Reminders**: 1 year retention for audit
- **Notification Records**: 90 days retention

## Performance Considerations

- Use pagination for large datasets
- Filter by date ranges to improve performance  
- Security events are indexed for faster retrieval
- Activity searches by user/cooperative are optimized
- Reminder queries by due date are highly optimized

## Support and Documentation

For detailed endpoint documentation, see:
- [Activity API Documentation](./ACTIVITY_API.md)
- [Reminder API Documentation](./REMINDER_API.md)

For integration support or questions, contact the development team.