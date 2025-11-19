# Room Management System - CoPay Platform

This document describes the comprehensive Room Management system implemented for the CoPay platform, which allows organizations/cooperatives to manage rooms with full CRUD operations while enforcing business rules for tenant assignments.

## Features

### Core Functionality
- **Complete CRUD operations** for room management
- **Role-based access control** (Super Admin, Organization Admin, Tenant)
- **Multi-cooperative tenant support** - tenants can belong to multiple cooperatives
- **One room per cooperative per tenant** - enforces business rule preventing multiple room assignments
- **Room assignment/unassignment** workflows
- **Comprehensive filtering and pagination**
- **Payment integration** ready (every payment linked to tenant + room + organization)

### Business Rules Enforced
1. A tenant can belong to multiple cooperatives
2. A tenant can have **only one room per cooperative**
3. A tenant **cannot have multiple rooms** in the same cooperative
4. Every payment must be linked to tenant + room + organization

## API Endpoints

### Room Management

#### Create Room
```http
POST /rooms
```
**Authorization**: Super Admin, Organization Admin  
**Body**: 
```json
{
  "roomNumber": "101",
  "roomType": "1BR",
  "floor": "1st Floor",
  "block": "Block A",
  "description": "Spacious one-bedroom apartment",
  "baseRent": 500.00,
  "deposit": 1000.00,
  "specifications": {
    "squareFeet": 650,
    "amenities": ["AC", "Balcony"]
  },
  "cooperativeId": "507f1f77bcf86cd799439012"
}
```

#### Get All Rooms (with filtering)
```http
GET /rooms?page=1&limit=10&search=101&status=AVAILABLE&roomType=1BR&floor=1st&block=A&cooperativeId=...
```
**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search by room number, type, or description
- `status` (optional): Filter by room status (AVAILABLE, OCCUPIED, MAINTENANCE, RESERVED, OUT_OF_SERVICE)
- `roomType` (optional): Filter by room type
- `floor` (optional): Filter by floor
- `block` (optional): Filter by block
- `cooperativeId` (optional): Filter by cooperative ID (Super Admin only)

#### Get Room by ID
```http
GET /rooms/:id
```

#### Update Room
```http
PATCH /rooms/:id
```
**Authorization**: Super Admin, Organization Admin

#### Delete Room
```http
DELETE /rooms/:id
```
**Authorization**: Super Admin, Organization Admin  
**Note**: Cannot delete rooms with active assignments or payment history

### Room Assignment Management

#### Assign User to Room
```http
POST /rooms/:id/assign
```
**Authorization**: Super Admin, Organization Admin  
**Body**:
```json
{
  "userId": "507f1f77bcf86cd799439013",
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": null,
  "notes": "Initial assignment"
}
```

#### Unassign User from Room
```http
POST /rooms/:id/unassign
```
**Authorization**: Super Admin, Organization Admin  
**Body**:
```json
{
  "userId": "507f1f77bcf86cd799439013",
  "reason": "Tenant moved out"
}
```

### Room Query Endpoints

#### Get Cooperative Room Assignments
```http
GET /rooms/assignments/cooperative/:cooperativeId
```
**Authorization**: Super Admin, Organization Admin

#### Get User's Rooms (All Cooperatives)
```http
GET /rooms/user/:userId
```

#### Get Current User's Rooms
```http
GET /rooms/me
```

## Database Schema

### Room Model
```prisma
model Room {
  id          String     @id @default(auto()) @map("_id") @db.ObjectId
  roomNumber  String     // Room/unit number (e.g., "101", "A-205")
  roomType    String?    // Type of room/unit (e.g., "1BR", "2BR", "Studio")
  floor       String?    // Floor number or identifier
  block       String?    // Building block or section
  description String?    // Additional description
  status      RoomStatus @default(AVAILABLE)

  // Pricing and settings
  baseRent Float? // Monthly rent amount
  deposit  Float? // Security deposit required

  // Room specifications
  specifications Json? // Flexible room specs

  // Relationships
  cooperativeId String      @db.ObjectId
  cooperative   Cooperative @relation(fields: [cooperativeId], references: [id])
  userCooperativeRooms UserCooperativeRoom[]
  payments Payment[]

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([cooperativeId, roomNumber]) // Unique room numbers per cooperative
  @@map("rooms")
}
```

### UserCooperativeRoom Model (Junction Table)
```prisma
model UserCooperativeRoom {
  id String @id @default(auto()) @map("_id") @db.ObjectId

  // Relationships
  userId String @db.ObjectId
  user   User   @relation(fields: [userId], references: [id])

  cooperativeId String      @db.ObjectId
  cooperative   Cooperative @relation(fields: [cooperativeId], references: [id])

  roomId String @db.ObjectId
  room   Room   @relation(fields: [roomId], references: [id])

  // Assignment details
  startDate DateTime  @default(now())
  endDate   DateTime?
  isActive  Boolean   @default(true)

  // Assignment metadata
  assignedBy String?  @db.ObjectId
  assignedAt DateTime @default(now())
  notes      String?

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, cooperativeId, isActive]) // One active room per user per cooperative
  @@unique([roomId, isActive]) // One active user per room
  @@map("user_cooperative_rooms")
}
```

### Room Status Enum
```prisma
enum RoomStatus {
  AVAILABLE
  OCCUPIED
  MAINTENANCE
  RESERVED
  OUT_OF_SERVICE
}
```

## File Structure

```
src/modules/room/
├── room.module.ts                 # Module definition
├── application/
│   └── room.service.ts           # Business logic and database operations
└── presentation/
    ├── room.controller.ts        # REST API endpoints
    └── dto/
        ├── index.ts              # DTO exports
        ├── create-room.dto.ts    # Room creation DTO
        ├── update-room.dto.ts    # Room update DTO
        ├── room-response.dto.ts  # Room response DTO
        ├── room-filter.dto.ts    # Room filtering DTO
        ├── assign-room.dto.ts    # Room assignment DTOs
        └── user-room-response.dto.ts # User room response DTO
```

## Security & Authorization

### Role-Based Access Control
- **Super Admin**: Full access to all operations across all cooperatives
- **Organization Admin**: Full access to operations within their cooperative
- **Tenant**: Read-only access to their own room assignments

### Tenant Isolation
- Organization Admins can only access rooms within their cooperative
- Tenants can only see their own room assignments
- Super Admins have cross-cooperative access for management purposes

## Business Logic Implementation

### Room Assignment Rules
1. **Uniqueness Constraints**:
   - One active user per room (`@@unique([roomId, isActive])`)
   - One active room per user per cooperative (`@@unique([userId, cooperativeId, isActive])`)

2. **Validation Logic**:
   - Check if user already has an active room in the cooperative
   - Verify room is available for assignment
   - Ensure proper authorization for assignment operations

3. **Assignment Lifecycle**:
   - Create new `UserCooperativeRoom` record with `isActive: true`
   - Update room status to `OCCUPIED`
   - Track assignment metadata (assignedBy, assignedAt, notes)

4. **Unassignment Process**:
   - Set `isActive: false` and `endDate` on existing assignment
   - Update room status to `AVAILABLE`
   - Maintain historical assignment records

## Integration Points

### Payment System Integration
- Every payment record links to:
  - `userId` (tenant)
  - `roomId` (specific room)
  - `cooperativeId` (organization)
- Room assignments provide the necessary relationships for payment processing

### User Management Integration
- Room assignments integrate with the existing User-Cooperative relationship system
- Supports multi-cooperative membership through junction table design

## Error Handling

### Common Error Scenarios
- **Room Assignment Conflicts**: User already has room in cooperative
- **Room Availability**: Room not available for assignment
- **Authorization**: Insufficient permissions for operation
- **Data Integrity**: Attempts to delete rooms with active assignments

### HTTP Status Codes
- `200`: Successful operation
- `201`: Resource created successfully
- `204`: Resource deleted successfully
- `400`: Bad request (validation errors)
- `401`: Unauthorized
- `403`: Forbidden (insufficient permissions)
- `404`: Resource not found
- `409`: Conflict (business rule violations)

## Usage Examples

### Assigning a Room to a Tenant
```typescript
// 1. Create a room
const room = await POST('/rooms', {
  roomNumber: "101",
  cooperativeId: "coop123",
  baseRent: 500
});

// 2. Assign to user
const assignment = await POST(`/rooms/${room.id}/assign`, {
  userId: "user123",
  startDate: new Date(),
  notes: "Initial assignment"
});

// 3. Verify assignment
const userRooms = await GET('/rooms/me');
```

### Filtering and Searching Rooms
```typescript
// Search for available 1BR rooms
const availableRooms = await GET('/rooms', {
  params: {
    status: 'AVAILABLE',
    roomType: '1BR',
    search: '1',  // Rooms containing '1' in number/type/description
    page: 1,
    limit: 10
  }
});
```

## Development and Testing

### Prerequisites
1. Prisma client generated: `npx prisma generate`
2. Database schema synchronized: `npx prisma db push`
3. Dependencies installed: `npm install`

### Running the Application
```bash
# Development
npm run start:dev

# Production build
npm run build
npm run start:prod
```

### API Testing
The room management endpoints are fully documented with Swagger/OpenAPI. Access the API documentation at `/api/docs` when the application is running.

## Future Enhancements

1. **Room Booking System**: Temporary room reservations
2. **Maintenance Scheduling**: Room maintenance workflow
3. **Room Photos**: Image upload and management
4. **Room Templates**: Standardized room configurations
5. **Reporting**: Room occupancy and revenue reports
6. **Notifications**: Assignment and payment reminders
7. **Room Transfer**: Move tenants between rooms
8. **Bulk Operations**: Mass room creation and assignment

This room management system provides a solid foundation for the CoPay platform's housing management needs while maintaining flexibility for future enhancements.