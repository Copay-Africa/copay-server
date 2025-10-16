# Co-Pay Backend Server

A production-grade NestJS backend for the Cooperative Payment System (Co-Pay) built with Domain-Driven Design (DDD) and Clean Architecture principles.

## 🚀 Features

- **Multi-tenancy**: Each cooperative operates as an isolated tenant
- **Role-based Access Control**: Super Admin, Organization Admin, and Tenant roles
- **JWT Authentication**: Secure phone number + 4-digit PIN authentication
- **Fastify**: High-performance web framework
- **MongoDB with Prisma**: Modern database ORM with type safety
- **Swagger Documentation**: Auto-generated API documentation
- **Rate Limiting**: Built-in throttling protection
- **Caching**: Redis-based caching for improved performance
- **Validation**: Comprehensive input validation with DTOs
- **Clean Architecture**: DDD modules with separation of concerns

## 🏗️ Architecture

```
src/
├── config/           # Configuration files and validation
├── modules/          # Feature modules (DDD structure)
│   ├── auth/         # Authentication & JWT
│   ├── user/         # User management & RBAC
│   └── ...           # Other business modules
├── shared/           # Shared utilities, guards, decorators
├── prisma/           # Database service and configuration
└── main.ts          # Application bootstrap with Fastify
```

## 📋 Prerequisites

- Node.js (v18+)
- MongoDB database
- Redis (optional, for caching)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd copay-backend-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your database URL and configuration:
   ```env
   DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/copay_db"
   JWT_SECRET="your-super-secret-jwt-key"
   # ... other configuration
   ```

4. **Generate Prisma client**
   ```bash
   npm run prisma:generate
   ```

5. **Seed the database** (optional)
   ```bash
   npm run prisma:seed
   ```

## 🚀 Running the Application

```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run start:prod

# Debug mode
npm run start:debug
```

The application will be available at:
- API: `http://localhost:3000/api/v1`
- Swagger Docs: `http://localhost:3000/docs`
- Health Check: `http://localhost:3000/api/v1/health`

## 📚 API Documentation

Access the interactive Swagger documentation at `http://localhost:3000/docs` when the server is running.

### Authentication

All endpoints except health checks require JWT authentication:

1. **Login** with phone number and PIN:
   ```bash
   POST /api/v1/auth/login
   {
     "phone": "+250788123456",
     "pin": "1234"
   }
   ```

2. **Use the JWT token** in subsequent requests:
   ```bash
   Authorization: Bearer <your-jwt-token>
   ```

### Default Users (from seed)

- **Super Admin**: `+250788000001` / PIN: `1234`
- **Organization Admin**: `+250788000002` / PIN: `2345`
- **Tenant**: `+250788000003` / PIN: `3456`

## 🗄️ Database

### Prisma Commands

```bash
# Generate Prisma client
npm run prisma:generate

# Push schema to database
npm run prisma:push

# Open Prisma Studio
npm run prisma:studio

# Seed database
npm run prisma:seed
```

### Database Schema

Key models:
- `User`: Multi-role user management with tenant isolation
- `Cooperative`: Tenant/organization management
- `Payment`: Payment processing and group payments
- `Transaction`: Financial transaction tracking
- `Complaint`: Customer complaint management

## 🔒 Security Features

- JWT-based authentication with configurable expiration
- Role-based access control (RBAC)
- Multi-tenant data isolation
- Input validation and sanitization
- Rate limiting and throttling
- Secure password hashing with bcrypt

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Watch mode
npm run test:watch
```

## 📦 Production Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Set production environment variables**
   ```bash
   NODE_ENV=production
   DATABASE_URL=<production-mongodb-url>
   JWT_SECRET=<secure-production-secret>
   ```

3. **Run in production**
   ```bash
   npm run start:prod
   ```

## 🔧 Configuration

Key environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | MongoDB connection string | Required |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_EXPIRES_IN` | JWT expiration | `7d` |
| `REDIS_HOST` | Redis host for caching | `localhost` |
| `CORS_ORIGIN` | Allowed CORS origins | `http://localhost:3000` |

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the existing patterns
4. Add tests for new functionality
5. Submit a pull request

## 📞 Support

For support, please contact the development team or create an issue in the repository.