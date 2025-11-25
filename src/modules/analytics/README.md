# Analytics API Documentation

## Overview

The Analytics module provides comprehensive business intelligence and analytics capabilities for the CoPay cooperative payment management system. It offers insights into payments, users, cooperatives, activities, and revenue through a set of RESTful endpoints.

## Authentication

All analytics endpoints require JWT authentication with appropriate role-based access:

- **SUPER_ADMIN**: Access to all analytics across all cooperatives
- **ORGANIZATION_ADMIN**: Access to analytics filtered to their cooperative
- **TREASURER**: Access to payment and revenue analytics for their cooperative
- **TENANT**: Limited access to summary analytics

## Base URL

```
/api/analytics
```

## Endpoints

### 1. Dashboard Statistics

**GET** `/analytics/dashboard`

Retrieve comprehensive dashboard statistics including user counts, payment volumes, and growth metrics.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| period | enum | No | Time period (`last_7_days`, `last_30_days`, `last_90_days`, `last_year`, `custom`) |
| startDate | string | No | Start date for custom period (ISO 8601 format) |
| endDate | string | No | End date for custom period (ISO 8601 format) |
| cooperativeId | string | No | Filter by specific cooperative |

#### Response

```json
{
  "totalUsers": 1250,
  "totalCooperatives": 45,
  "totalPayments": 3420,
  "totalPaymentAmount": 85600000,
  "pendingAccountRequests": 12,
  "activeReminders": 150,
  "openComplaints": 3,
  "growthPercentage": {
    "users": 12.5,
    "payments": 8.3,
    "revenue": 15.7
  }
}
```

### 2. Payment Analytics

**GET** `/analytics/payments`

Retrieve detailed payment analytics including volume, success rates, and trends.

#### Query Parameters

Same as dashboard endpoint.

#### Response

```json
{
  "totalVolume": 3420,
  "totalAmount": 85600000,
  "averageAmount": 25029,
  "successRate": 95.2,
  "mostPopularMethod": "MOBILE_MONEY_MTN",
  "trends": [
    {
      "date": "2025-01-01",
      "volume": 45,
      "amount": 1200000
    }
  ],
  "statusDistribution": [
    {
      "status": "COMPLETED",
      "count": 3256,
      "percentage": 95.2
    }
  ],
  "methodDistribution": [
    {
      "method": "MOBILE_MONEY_MTN",
      "count": 1520,
      "percentage": 44.4
    }
  ]
}
```

### 3. User Analytics

**GET** `/analytics/users`

Retrieve user analytics including registrations, activity, and growth metrics.

#### Query Parameters

Same as dashboard endpoint.

#### Response

```json
{
  "totalUsers": 1250,
  "activeUsers": 890,
  "newRegistrations": 85,
  "growthRate": 12.5,
  "activityTrends": [
    {
      "date": "2025-01-01",
      "activeUsers": 45,
      "newUsers": 3
    }
  ],
  "roleDistribution": [
    {
      "role": "TENANT",
      "count": 1150,
      "percentage": 92.0
    }
  ],
  "statusDistribution": [
    {
      "status": "ACTIVE",
      "count": 1200,
      "percentage": 96.0
    }
  ]
}
```

### 4. Cooperative Analytics

**GET** `/analytics/cooperatives`

Retrieve cooperative analytics including performance metrics and growth trends. **Super Admin only**.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| period | enum | No | Time period for analytics |
| startDate | string | No | Start date for custom period |
| endDate | string | No | End date for custom period |

#### Response

```json
{
  "totalCooperatives": 45,
  "activeCooperatives": 42,
  "averageMembers": 27.8,
  "topPerforming": [
    {
      "id": "coop123",
      "name": "Green Hills Cooperative",
      "memberCount": 45,
      "totalPayments": 520,
      "totalRevenue": 13500000
    }
  ],
  "growthTrends": [
    {
      "date": "2025-01-01",
      "newCooperatives": 2,
      "totalMembers": 60
    }
  ],
  "paymentFrequencyDistribution": [
    {
      "frequency": "MONTHLY",
      "count": 38,
      "percentage": 84.4
    }
  ]
}
```

### 5. Activity Analytics

**GET** `/analytics/activity`

Retrieve activity analytics including user behavior patterns and security events.

#### Query Parameters

Same as dashboard endpoint.

#### Response

```json
{
  "totalActivities": 15420,
  "topActivityTypes": [
    {
      "type": "LOGIN",
      "count": 5200,
      "percentage": 33.7
    }
  ],
  "securityEvents": 12,
  "failedLogins": 8,
  "activityTrends": [
    {
      "date": "2025-01-01",
      "totalActivities": 420,
      "securityEvents": 2
    }
  ],
  "peakHours": [
    {
      "hour": 9,
      "count": 850
    }
  ]
}
```

### 6. Revenue Analytics

**GET** `/analytics/revenue`

Retrieve comprehensive revenue analytics including trends and breakdowns.

#### Query Parameters

Same as dashboard endpoint.

#### Response

```json
{
  "totalRevenue": 85600000,
  "growthPercentage": 15.7,
  "averageRevenuePerUser": 68480,
  "averageRevenuePerCooperative": 1902222,
  "revenueTrends": [
    {
      "date": "2025-01-01",
      "revenue": 2300000,
      "transactionCount": 95
    }
  ],
  "revenueByCooperative": [
    {
      "cooperativeId": "coop123",
      "cooperativeName": "Green Hills Cooperative",
      "revenue": 13500000,
      "percentage": 15.8
    }
  ],
  "revenueByMethod": [
    {
      "method": "MOBILE_MONEY_MTN",
      "revenue": 38000000,
      "percentage": 44.4
    }
  ]
}
```

### 7. Analytics Summary

**GET** `/analytics/summary`

Retrieve a comprehensive summary of all analytics data for quick overview.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| period | enum | No | Time period for analytics |
| cooperativeId | string | No | Filter by specific cooperative |

#### Response

```json
{
  "dashboard": { /* DashboardStatsDto */ },
  "payments": { /* PaymentAnalyticsDto */ },
  "users": { /* UserAnalyticsDto */ },
  "activity": { /* ActivityAnalyticsDto */ },
  "revenue": { /* RevenueAnalyticsDto */ }
}
```

### 8. Export Analytics

**GET** `/analytics/export`

Export analytics data in CSV format for external analysis.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | enum | Yes | Type of analytics data (`payments`, `users`, `revenue`) |
| period | enum | No | Time period for analytics |
| cooperativeId | string | No | Filter by specific cooperative |

#### Response

Returns CSV data as text/csv content type.

## Time Periods

The analytics API supports the following time periods:

- `last_7_days`: Last 7 days from now
- `last_30_days`: Last 30 days from now (default)
- `last_90_days`: Last 90 days from now
- `last_year`: Last 365 days from now
- `custom`: Custom date range (requires startDate and endDate)

## Role-Based Access Control

### Super Admin (`SUPER_ADMIN`)
- Access to all analytics endpoints
- Can view analytics across all cooperatives
- Access to cooperative analytics endpoint
- No filtering restrictions

### Organization Admin (`ORGANIZATION_ADMIN`)
- Access to dashboard, payment, user, activity, and revenue analytics
- Automatically filtered to their cooperative
- Cannot access cooperative analytics endpoint

### Treasurer (`TREASURER`)
- Access to payment and revenue analytics
- Automatically filtered to their cooperative
- Limited dashboard access

### Tenant (`TENANT`)
- Access to summary analytics only
- Automatically filtered to their cooperative
- Read-only access

## Error Responses

All endpoints return standard HTTP error responses:

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

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

## Rate Limiting

Analytics endpoints are subject to the following rate limits:
- 100 requests per minute per user
- 20 requests per minute per IP for export endpoints

## Examples

### Get Dashboard Statistics for Last 30 Days

```bash
curl -X GET "https://api.copay.rw/analytics/dashboard?period=last_30_days" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Get Payment Analytics for Specific Cooperative

```bash
curl -X GET "https://api.copay.rw/analytics/payments?cooperativeId=coop123&period=last_90_days" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Export Revenue Data as CSV

```bash
curl -X GET "https://api.copay.rw/analytics/export?type=revenue&period=last_30_days" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Accept: text/csv" \
  -o revenue_analytics.csv
```

### Get Custom Date Range Analytics

```bash
curl -X GET "https://api.copay.rw/analytics/summary?period=custom&startDate=2025-01-01T00:00:00.000Z&endDate=2025-01-31T23:59:59.999Z" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

## Features

### Real-time Data
All analytics data is calculated in real-time from the database, ensuring accuracy and up-to-date information.

### Growth Calculations
Growth percentages are automatically calculated by comparing current period data with the equivalent previous period.

### Trend Analysis
Daily trend data is provided for payments, user activity, and revenue to enable time-series analysis.

### Security Monitoring
Activity analytics include security event tracking for monitoring system security and user behavior.

### Export Capabilities
Data can be exported in CSV format for further analysis in external tools like Excel or business intelligence platforms.

### Scalable Architecture
The analytics service is designed to handle large datasets efficiently with proper indexing and optimized queries.