# 🔥 Firebase Configuration Guide

This guide explains how to securely configure Firebase for the Copay Backend Server.

## 📋 Prerequisites

- Firebase project (copay-2be06)
- Firebase Admin SDK enabled
- Service account with appropriate permissions

## 🛠️ Development Setup

### 1. Download Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: `copay-2be06`
3. Go to Project Settings → Service Accounts
4. Click "Generate new private key"
5. Save as `firebase-service-account.json` (do NOT commit this file)

### 2. Configure Environment Variables

Create `.env.local` with:

```bash
FIREBASE_PROJECT_ID="copay-2be06"
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"copay-2be06",...}'
```

### 3. Alternative: File-based Configuration

For easier development, you can use a file path:

```typescript
// In development, you can modify FcmService to use file path:
const serviceAccount = require('../../../firebase-service-account.json');
```

## 🚀 Production Deployment

### Vercel Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

```bash
FIREBASE_PROJECT_ID=copay-2be06
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

**Note**: Vercel has a 4KB limit for environment variables. For large service account keys, consider:

1. **Base64 encoding** the JSON
2. **Using multiple environment variables** for different parts
3. **External secret management** (recommended for production)

### Alternative: External Secret Management

#### Option 1: Vercel KV (Recommended)
```typescript
// Store service account in Vercel KV
const serviceAccount = await kv.get('firebase-service-account');
```

#### Option 2: AWS Secrets Manager
```typescript
// Fetch from AWS Secrets Manager
const secret = await secretsManager.getSecretValue({
  SecretId: 'copay/firebase-service-account'
}).promise();
```

#### Option 3: Environment Variable Chunking
```bash
# Split large JSON into chunks
FIREBASE_SERVICE_ACCOUNT_PART_1={"type":"service_account","project_id":...
FIREBASE_SERVICE_ACCOUNT_PART_2=..."private_key":"-----BEGIN PRIVATE KEY-----...
FIREBASE_SERVICE_ACCOUNT_PART_3=...-----END PRIVATE KEY-----","client_email":...
```

## 🔧 FcmService Configuration

The service automatically handles multiple configuration methods:

```typescript
// 1. Environment variable (JSON string)
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

// 2. File path (development only)
FIREBASE_SERVICE_ACCOUNT_FILE_PATH="./firebase-service-account.json"

// 3. Base64 encoded
FIREBASE_SERVICE_ACCOUNT_BASE64="eyJ0eXBlIjoi..."

// 4. External secret management
FIREBASE_SECRET_MANAGER_ID="copay/firebase-service-account"
```

## 🔐 Security Best Practices

### ✅ DO
- Use different service accounts for different environments
- Regularly rotate service account keys
- Limit service account permissions to minimum required
- Use external secret management for production
- Monitor Firebase usage and logs

### ❌ DON'T
- Commit service account keys to version control
- Use production keys in development
- Share service account keys via email/chat
- Store keys in plain text files in production

## 🛡️ Service Account Permissions

Required permissions for FCM:
- `Firebase Cloud Messaging API`
- `Firebase Admin SDK`

Minimal IAM roles:
- `Firebase Admin`
- `Cloud Messaging Admin` (if separate)

## 🚨 Security Incident Response

If service account key is compromised:

1. **Immediately disable** the compromised key in Firebase Console
2. **Generate new** service account key
3. **Update all environments** with new key
4. **Audit Firebase logs** for unauthorized usage
5. **Document** the incident

## 📊 Monitoring

Set up monitoring for:
- FCM message delivery rates
- Failed authentication attempts
- Unusual usage patterns
- Service account key age

## 🧪 Testing

Test Firebase configuration:

```bash
# Test health endpoint
curl https://your-app.vercel.app/api/v1/health

# Check Firebase configuration
curl https://your-app.vercel.app/api/v1/health/config
```

## 📞 Support

For Firebase-related issues:
- Check Firebase Console logs
- Review service account permissions
- Verify environment variable configuration
- Contact Firebase support if needed