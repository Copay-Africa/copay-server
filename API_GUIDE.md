# Co-Pay API Testing Guide

## Phase 1: Authentication & Onboarding

This guide shows how to use the Co-Pay APIs to onboard cooperatives and tenants.

### 1. Login as Super Admin

First, authenticate as the Super Admin to get access token:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+250788000001",
    "pin": "1234"
  }'
```

Expected Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 604800,
  "user": {
    "id": "...",
    "phone": "+250788000001",
    "role": "SUPER_ADMIN"
  }
}
```

### 2. Create a New Cooperative

Use the access token to create a new cooperative:

```bash
curl -X POST http://localhost:3000/api/v1/cooperatives \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "Nyamirambo Housing Cooperative",
    "code": "NHC001",
    "description": "A housing cooperative in Nyamirambo for affordable housing solutions",
    "address": "Nyamirambo, Kigali, Rwanda",
    "phone": "+250788111222",
    "email": "admin@nyamirambo.coop",
    "settings": {
      "currency": "RWF",
      "timezone": "Africa/Kigali",
      "paymentDueDay": 15,
      "reminderDays": [7, 3, 1]
    }
  }'
```

### 3. Create Organization Admin for the Cooperative

```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "phone": "+250788111223",
    "pin": "2345",
    "firstName": "Marie",
    "lastName": "Uwimana",
    "email": "marie.uwimana@nyamirambo.coop",
    "role": "ORGANIZATION_ADMIN",
    "cooperativeId": "COOPERATIVE_ID_FROM_STEP_2"
  }'
```

### 4. Login as Organization Admin

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+250788111223",
    "pin": "2345"
  }'
```

### 5. Create Tenant Users

As Organization Admin, create tenant users:

```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ORG_ADMIN_ACCESS_TOKEN" \
  -d '{
    "phone": "+250788111224",
    "pin": "3456",
    "firstName": "Jean",
    "lastName": "Mukamana",
    "email": "jean.mukamana@example.com",
    "role": "TENANT",
    "cooperativeId": "COOPERATIVE_ID"
  }'
```

### 6. Get All Cooperatives (Super Admin view)

```bash
curl -X GET "http://localhost:3000/api/v1/cooperatives?page=1&limit=10" \
  -H "Authorization: Bearer SUPER_ADMIN_ACCESS_TOKEN"
```

### 7. Get All Users in Cooperative (Organization Admin view)

```bash
curl -X GET "http://localhost:3000/api/v1/users?page=1&limit=10" \
  -H "Authorization: Bearer ORG_ADMIN_ACCESS_TOKEN"
```

## Testing with Swagger UI

1. Open http://localhost:3000/docs
2. Click "Authorize" button
3. Use the access token from login response
4. Test the endpoints interactively

## Seeded Data

The application comes with pre-seeded data:

- **Super Admin**: +250788000001 (PIN: 1234)
- **Organization Admin**: +250788000002 (PIN: 2345)
- **Tenants**: +250788000003, +250788000004 (PIN: 3456)
- **Default Cooperative**: "Default Cooperative" (Code: DEFAULT_COOP)

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login with phone and PIN

### Cooperatives
- `GET /api/v1/cooperatives` - List cooperatives (with pagination)
- `POST /api/v1/cooperatives` - Create cooperative (Super Admin only)
- `GET /api/v1/cooperatives/:id` - Get cooperative by ID
- `PATCH /api/v1/cooperatives/:id/status` - Update cooperative status

### Users
- `GET /api/v1/users` - List users (with pagination, tenant-aware)
- `POST /api/v1/users` - Create user (Super Admin, Org Admin)
- `GET /api/v1/users/:id` - Get user by ID
- `PATCH /api/v1/users/:id/status` - Update user status

### Activities (New)
- `GET /api/activities` - List user activities with filtering
- `GET /api/activities/me` - Get current user activities
- `GET /api/activities/security` - Get security events (Admin only)
- `POST /api/activities` - Create activity record (System use)

### Reminders (New)
- `GET /api/reminders` - List payment reminders with filtering
- `POST /api/reminders` - Create new payment reminder
- `GET /api/reminders/me` - Get current user reminders
- `GET /api/reminders/due` - Get due/overdue reminders
- `GET /api/reminders/:id` - Get specific reminder
- `PUT /api/reminders/:id` - Update reminder
- `DELETE /api/reminders/:id` - Delete reminder

### Health Check
- `GET /api/v1/` - Basic health check
- `GET /api/v1/health` - Detailed health check

## Multi-Tenancy

The system implements multi-tenancy:
- **Super Admins** can see all cooperatives and users
- **Organization Admins** can only see users in their cooperative
- **Tenants** can only see their own data (when implemented)

## Role-Based Access Control (RBAC)

- **SUPER_ADMIN**: Full system access
- **ORGANIZATION_ADMIN**: Manage users in their cooperative
- **TENANT**: Basic user operations (limited access)

## Security Features

- JWT authentication with 7-day expiration
- Role-based access control
- Multi-tenant data isolation
- Input validation with class-validator
- Rate limiting (100 requests per minute)
- CORS protection
- Request/response logging

## Additional Documentation

For detailed API documentation of the new modules:

- **[Complete API Documentation](./API_DOCUMENTATION.md)** - Overview of Activity and Reminder APIs
- **[Activity API Documentation](./ACTIVITY_API.md)** - Detailed documentation for user activity tracking
- **[Reminder API Documentation](./REMINDER_API.md)** - Detailed documentation for payment reminders
- **[Payment API Documentation](./PAYMENTS.md)** - Payment system documentation