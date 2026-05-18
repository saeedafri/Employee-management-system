# EMS Backend - Deployment Guide

**Target**: Render.com (Free Tier)  
**Database**: MySQL (managed or self-hosted)  
**Cache**: Redis (free tier or managed)  

---

## Pre-Deployment Checklist

- [ ] All tests passing (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Environment variables configured
- [ ] Database migrations tested locally
- [ ] Email (SMTP) credentials verified
- [ ] GitHub repository updated
- [ ] API documentation reviewed
- [ ] Monitoring alerts configured

---

## Step 1: Prepare Production Environment Variables

Create `.env.production` (never commit to git):

```env
# Environment
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database (AWS RDS MySQL)
DATABASE_URL="mysql://admin:YourSecurePassword@ems-prod.c123456.us-east-1.rds.amazonaws.com:3306/ems_production"

# Redis (Redis Cloud or ElastiCache)
REDIS_URL="redis://:password@redis-prod-123.redislabs.com:12345"

# JWT Secret (generate: `openssl rand -base64 32`)
JWT_SECRET="YOUR_PRODUCTION_JWT_SECRET_HERE_MIN_32_CHARS"
ACCESS_TOKEN_EXPIRES_IN="15m"
REFRESH_TOKEN_EXPIRES_IN="7d"

# CORS (allow frontend domain only)
CORS_ORIGIN="https://ems.company.com,https://app.company.com"

# Email Provider (Brevo)
EMAIL_PROVIDER="smtp"
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT="587"
SMTP_USER="your-brevo-account@smtp-brevo.com"
SMTP_PASS="xsmtpsib-YOUR-BREVO-API-KEY"
SMTP_FROM="noreply@company.com"

# API Configuration
APP_NAME="EMS"
APP_VERSION="1.0.0"
API_PREFIX="/api/v1"

# Session
SESSION_COOKIE_NAME="refreshToken"
SESSION_MAX_AGE_DAYS=7

# Password Reset
RESET_PASSWORD_TOKEN_TTL_MINUTES=30
FRONTEND_RESET_PASSWORD_URL="https://ems.company.com/reset-password"
```

---

## Step 2: Set Up Database (AWS RDS MySQL)

### Create RDS MySQL Instance

1. **AWS Console** → RDS → Databases → Create database
2. **Configuration**:
   - Engine: MySQL 8.0
   - Instance: `db.t3.micro` (free tier eligible)
   - Storage: 20GB
   - Multi-AZ: No (for free tier)
   - Publicly accessible: Yes (for initial migrations)

3. **Security Group**:
   - Inbound: Port 3306 from Render IP
   - Outbound: Allow all

4. **Database Name**: `ems_production`

5. **Master User**:
   ```
   Username: admin
   Password: YourSecurePassword (≥20 chars, use aws secretsmanager)
   ```

### Run Migrations

```bash
# From your development machine
export DATABASE_URL="mysql://admin:password@ems-prod.c123.rds.amazonaws.com/ems_production"

# Run pending migrations
npm run db:migrate:prod

# Seed production data (optional)
npm run db:seed:production
```

---

## Step 3: Set Up Redis (ElastiCache or Redis Cloud)

### Option A: AWS ElastiCache

1. **AWS Console** → ElastiCache → Redis → Create cluster
2. **Configuration**:
   - Engine: Redis 6.2+
   - Node type: `cache.t3.micro`
   - Number of nodes: 1
   - Automatic failover: Disabled (for free tier)
3. **Security Group**: Allow port 6379 from Render IP
4. **Auth**: Enable Redis AUTH (recommended)
   ```
   Redis Auth Token: GenerateSecureToken
   ```

### Option B: Redis Cloud (Free Tier)

1. Visit: https://redis.com/try-free
2. Create account & database
3. Copy connection string: `redis://:password@host:port`

### Verify Redis Connection

```bash
redis-cli -u "redis://:password@host:port" ping
# Should return: PONG
```

---

## Step 4: Deploy to Render.com

### 1. Push Code to GitHub

```bash
git add .
git commit -m "feat: production-ready deployment"
git push origin main
```

### 2. Create Render Account

- Visit: https://render.com
- Sign up with GitHub
- Connect GitHub account

### 3. Create Web Service

**Render Dashboard** → New → Web Service

**Configuration**:

| Setting | Value |
|---------|-------|
| Repository | Select your GitHub repo |
| Branch | main |
| Build Command | `npm install && npm run db:migrate:prod` |
| Start Command | `npm start` |
| Environment | Node |
| Node Version | 20 |

### 4. Add Environment Variables

Click **Environment** → Add from `.env.production`:

```
DATABASE_URL=mysql://admin:password@...
REDIS_URL=redis://:password@...
JWT_SECRET=YOUR_SECRET
... (all other vars)
```

### 5. Create Auto-Deploy

**Settings** → **Auto-Deploy** → Select branch (main)  
→ Enable "Auto-deploy new commits pushed to branch"

---

## Step 5: Post-Deployment Verification

### Health Check

```bash
curl https://YOUR-APP.onrender.com/health
# Response: {"status":"ok"}
```

### Test API Endpoints

```bash
# Login
curl -X POST https://YOUR-APP.onrender.com/api/v1/auth/login \
  -H "x-tenant-key: acme" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"password"}'

# Get employees
curl https://YOUR-APP.onrender.com/api/v1/employees \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-key: acme"
```

### View Logs

**Render Dashboard** → Your Service → **Logs**

```
Search for:
- "Server started" (startup success)
- "Database connected" (DB connection)
- "error" (any errors)
```

---

## Step 6: SSL/HTTPS Configuration

**Render** automatically provides SSL certificate via Let's Encrypt.

Verify:
```bash
curl https://YOUR-APP.onrender.com --verbose
# Should show: SSL certificate verified
```

---

## Step 7: Monitoring & Logging

### Error Tracking (Sentry - Optional)

```bash
# Install Sentry
npm install @sentry/node

# Configure in src/server.js
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});
```

### Application Performance Monitoring (APM)

Monitor via Render Dashboard:
- CPU usage
- Memory consumption
- Disk I/O
- Network requests
- Restart frequency

### Database Monitoring

AWS RDS CloudWatch metrics:
- CPU utilization
- Database connections
- Query performance
- Storage space

---

## Step 8: Backup Strategy

### RDS Automatic Backups

```
Backup retention period: 7 days
Backup window: 03:00-04:00 UTC
Multi-AZ: Enable in production (after free tier)
```

### Manual Snapshot (Before Major Changes)

```bash
# AWS CLI
aws rds create-db-snapshot \
  --db-instance-identifier ems-prod \
  --db-snapshot-identifier ems-prod-backup-$(date +%Y%m%d)
```

---

## Step 9: Scaling Strategy

### Vertical Scaling (Larger Dyno)

If CPU/Memory at >80%:
```
Render → Settings → Instance Type → Upgrade
Standard → Pro (automatic deployment)
```

### Horizontal Scaling

For multiple instances (paid tier):
```
Render → Settings → Num Instances → 3
Load balancer auto-configures
```

### Database Scaling

Upgrade RDS instance class:
```bash
aws rds modify-db-instance \
  --db-instance-identifier ems-prod \
  --db-instance-class db.t3.small \
  --apply-immediately
```

---

## Step 10: CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Render

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Tests
        run: npm ci && npm test
      
      - name: Run Linting
        run: npm run lint
      
      - name: Deploy to Render
        if: success()
        run: |
          curl -X POST \
            https://api.render.com/deploy/srv-${{ secrets.RENDER_SERVICE_ID }}?key=${{ secrets.RENDER_API_KEY }}
```

---

## Troubleshooting Deployment

### Issue: "Build failed: npm install error"

```bash
# Solution: Clear Render build cache
Render Dashboard → Service → Settings → Redeploy
```

### Issue: "Database connection refused"

```bash
# Verify connectivity
mysql -h ems-prod.c123.rds.amazonaws.com -u admin -p -e "SELECT 1"

# Check security group rules
AWS Console → Security Groups → Port 3306 from Render IPs
```

### Issue: "OTP emails not sending"

```bash
# Verify SMTP credentials
npm run email:test -- --to test@company.com

# Check Redis queue
redis-cli -u $REDIS_URL LLEN bullmq:email:*
```

### Issue: "Out of memory / Service restart loop"

```bash
# Check memory usage
curl https://YOUR-APP.onrender.com/health (should respond)

# Reduce Node memory
NODE_OPTIONS="--max-old-space-size=512" npm start

# Upgrade instance type (Render Dashboard)
```

### Issue: "Slow API responses"

```bash
# Check database query performance
MySQL → Query logs → Look for slow queries

# Add database index
npx prisma db push (after schema.prisma changes)

# Monitor with Render metrics
```

---

## Production Maintenance

### Weekly Tasks

- ✅ Check logs for errors
- ✅ Monitor API response times
- ✅ Verify backups are running
- ✅ Review security logs

### Monthly Tasks

- ✅ Review & optimize slow queries
- ✅ Update dependencies (`npm audit fix`)
- ✅ Test disaster recovery procedure
- ✅ Review RBAC permissions

### Quarterly Tasks

- ✅ Database optimization (ANALYZE TABLE)
- ✅ SSL certificate renewal (automatic)
- ✅ Performance benchmarking
- ✅ Capacity planning

---

## Disaster Recovery

### Database Restore from Snapshot

```bash
# List snapshots
aws rds describe-db-snapshots --db-snapshot-identifier ems-prod-backup-*

# Restore to new instance
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier ems-prod-restored \
  --db-snapshot-identifier ems-prod-backup-20260518

# Update DNS to point to new instance
# Update DATABASE_URL in Render
# Trigger redeploy
```

### Application Rollback

```bash
# Render Dashboard → Service → Activity → Previous Deploy
# Click "Redeploy" next to previous version

# Or via git
git revert HEAD
git push origin main
# Render auto-deploys
```

---

## Production Checklist

- [ ] Environment variables loaded from Render secrets
- [ ] Database migrations applied
- [ ] Redis connection verified
- [ ] Email (SMTP) tested
- [ ] SSL certificate active
- [ ] API health check working
- [ ] Error tracking (Sentry) configured
- [ ] Monitoring alerts set up
- [ ] Backup schedule confirmed
- [ ] Disaster recovery tested
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Documentation updated
- [ ] Team trained on deployment
- [ ] Incident response plan ready

---

## Support & Resources

- **Render Docs**: https://render.com/docs
- **MySQL Docs**: https://dev.mysql.com/doc
- **Redis Docs**: https://redis.io/docs
- **GitHub Actions**: https://docs.github.com/en/actions
- **Status Page**: https://status.render.com

---

## Example: Complete Production Setup (15 minutes)

```bash
# 1. Create RDS MySQL
# (AWS Console - 2 minutes)

# 2. Create Redis instance
# (Redis Cloud - 1 minute)

# 3. Push to GitHub
git push origin main

# 4. Connect to Render
# (Render Dashboard - 3 minutes)

# 5. Set environment variables
# (Render Dashboard - 2 minutes)

# 6. Deploy
# (Automatic on push - 5 minutes)

# 7. Verify
curl https://YOUR-APP.onrender.com/health

# ✅ Live in production!
```

---

## Cost Estimate (Monthly)

| Service | Tier | Cost |
|---------|------|------|
| Render Web Service | Standard | $7 |
| AWS RDS MySQL | db.t3.micro | ~$15 (free first 12mo) |
| Redis Cloud | Free | $0 |
| **Total** | | ~$22/month |

---

**Deployment Ready!** 🚀

Your EMS backend is now ready for production deployment.  
Follow the steps above to go live on Render.com.
