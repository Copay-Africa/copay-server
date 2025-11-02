# 🔒 Secrets Management Guide

This guide explains how to securely manage credentials for the Copay Backend Server.

## 📁 File Structure

```
copay-backend-server/
├── .env                    # Base configuration (no secrets)
├── .env.example           # Template with placeholder values
├── .env.local             # Development secrets (gitignored)
├── secrets/               # Secret management utilities
│   ├── README.md          # This file
│   ├── firebase-setup.md  # Firebase configuration guide
│   └── production.md      # Production deployment guide
└── .gitignore            # Excludes .env.local and secret files
```

## 🛠️ Development Setup

### 1. Create Local Environment File
```bash
cp .env.example .env.local
```

### 2. Update .env.local with Real Values
Edit `.env.local` with your actual development credentials:
- Firebase service account key
- Database connection strings
- API keys
- SMS credentials

### 3. Load Order
NestJS will load environment variables in this order:
1. `.env` (base configuration)
2. `.env.local` (development secrets - overrides .env)
3. Process environment variables (production)

## 🚀 Production Deployment

### Vercel
Set environment variables in Vercel Dashboard:
```bash
vercel env add FIREBASE_PROJECT_ID
vercel env add FIREBASE_SERVICE_ACCOUNT_KEY
vercel env add DATABASE_URL
# ... other secrets
```

### AWS/Other Cloud Providers
Use their respective secret management services:
- AWS Secrets Manager
- Google Secret Manager
- Azure Key Vault
- HashiCorp Vault

## 🔐 Security Best Practices

### ✅ DO
- Use `.env.local` for development (gitignored)
- Store production secrets in cloud secret managers
- Rotate credentials regularly
- Use different credentials for different environments
- Limit access permissions to minimum required

### ❌ DON'T
- Commit secrets to version control
- Share credentials via email/chat
- Use production credentials in development
- Hardcode secrets in source code
- Store secrets in plain text files

## 🔄 Environment Configuration

### Development (.env.local)
```bash
NODE_ENV=development
FIREBASE_PROJECT_ID=copay-dev-project
DATABASE_URL=mongodb://localhost:27017/copay-dev
```

### Staging
```bash
NODE_ENV=staging
FIREBASE_PROJECT_ID=copay-staging-project
DATABASE_URL=mongodb+srv://staging-user:pass@staging-cluster/copay-staging
```

### Production
```bash
NODE_ENV=production
FIREBASE_PROJECT_ID=copay-2be06
DATABASE_URL=mongodb+srv://prod-user:pass@prod-cluster/copay
```

## 🚨 Emergency Response

### If Credentials Are Compromised:
1. **Immediately rotate** all affected credentials
2. **Revoke access** for compromised keys
3. **Update** all deployments with new credentials
4. **Audit logs** for unauthorized access
5. **Document** the incident and response

## 📞 Support

For questions about secrets management, contact the DevOps team or create an issue in the repository.