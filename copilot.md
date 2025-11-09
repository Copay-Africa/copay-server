# Intro

Copay: is To simplify rent and related cooperative payments for tenants and managers through a unified, digital, and accessible payment solution.

💎 The Solution: Copay

A multi-channel digital payment platform for cooperatives to collect, track, and manage rent-related payments — all integrated with local payment gateways and IremboPay.

-------

## Instructions

You are an expert NestJS architect.
Build a production-grade NestJS backend following Domain-Driven Design (DDD) and Clean Architecture.

Use TypeScript, Prisma ORM (MongoDB), JWT authentication, and follow NestJS best practices for modular design and scalability.

Build a fast, optimized, and well-structured NestJS backend for a Cooperative Payment System (Copay) that supports:

1. Web (Next.js frontend)
2. Mobile (Flutter app)
3. USSD clients

The system supports multi-tenancy (each Cooperative = one tenant).
There are three main user types:

1. Organization (Cooperative) Admin – onboard new cooperatives, manage their members, and view transactions.
2. Tenant (Member) – sign up with phone number + 4-digit PIN, can make and receive group payments, complaints, reminders, etc.
3. Super Admin – system-wide control, manage cooperatives, monitor anomalies, etc.

## Code Style Guide

1. Write clear, documented, and human-readable code.
2. Follow SOLID principles and NestJS conventions.
3. Use functional service layers with dependency injection.
4. Ensure every module is independent and reusable.
5. Prefer clarity over cleverness.

## Performance Best Practices

1. Use Fastify instead of Express
2. Enable response compression
3. Add global caching with Redis
4. Use query optimization and database indexes
5. Add pagination & filtering on all list endpoints
6. Minimize payloads — send only required fields
7. Use async/await efficiently, avoid blocking code
8. Use rate limiting and API key validation for public endpoints
9. Enable cluster mode / load balancing support for multi-core scaling
10. Prepare code for horizontal scaling (stateless design)

## Code Quality Rules

1. Always use DTOs with class-validator
2. Use Guards, Interceptors, and Filters for clean flow
3. Each module must be independent and reusable
4. Follow SOLID principles
5. Write clean, commented, human-readable code
6. Include Swagger decorators for all endpoints
7. Add unit tests for critical services (auth, user)