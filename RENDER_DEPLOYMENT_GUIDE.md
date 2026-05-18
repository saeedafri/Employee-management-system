# 🚀 Render Deployment - Step-by-Step Visual Guide

**Time Required**: 30 minutes  
**Cost**: Free tier available  
**What You'll Deploy**: Full EMS backend with database

---

## CHECKLIST BEFORE STARTING

- ✅ Code pushed to GitHub (Employee-management-system repo)
- ✅ Render account created (https://dashboard.render.com)
- ✅ GitHub connected to Render
- ✅ Environment variables prepared (from .env file)

---

## PART 1: PUSH CODE TO GITHUB

### From Your Local Terminal

```bash
cd /Users/mohdsaeedafri/All-Code-Base/EMS

# Set correct remote
git remote remove origin
git remote add origin https://github.com/saeedafri/Employee-management-system.git

# Push code
git branch -M main
git push -u origin main
```

**You'll be prompted to log in with GitHub credentials**

### Verify on GitHub

After push completes, check:  
📍 https://github.com/saeedafri/Employee-management-system

You should see:
- ✅ All source code files
- ✅ All documentation
- ✅ All commits in history

---

## PART 2: CREATE WEB SERVICE ON RENDER

### Step 1: Go to Render Dashboard

1. Visit: **https://dashboard.render.com/**
2. Click **"New +"** button (top right)
3. Select **"Web Service"**

**Screenshot reference:**
```
Dashboard shows:
┌─────────────────────────────────────┐
│ Dashboard  Build  Blueprints   [New +]   │
└─────────────────────────────────────┘
    ↓ Click "New +"
    ↓ Choose "Web Service"
```

### Step 2: Connect GitHub Repository

**You'll see this screen:**
```
┌──────────────────────────────────────┐
│ Connect a repository                  │
├──────────────────────────────────────┤
│ GitHub                               │
│ (Click to select repo)               │
└──────────────────────────────────────┘
```

**Actions:**
1. Click on GitHub section
2. **Search for**: `Employee-management-system`
3. **Select**: `saeedafri/Employee-management-system`
4. **Click**: "Connect"

### Step 3: Configure Web Service

**Fill in these fields:**

| Field | Value |
|-------|-------|
| **Name** | `ems-backend` |
| **Region** | Choose closest (e.g., `US East`) |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run db:migrate:prod` |
| **Start Command** | `npm start` |
| **Plan** | `Free` (or Starter for production) |

**Screenshot template:**
```
┌─────────────────────────────────────┐
│ Service Settings                     │
├─────────────────────────────────────┤
│ Name: [ems-backend          ]       │
│ Region: [US East           ▼]       │
│ Build Command: [npm install...]     │
│ Start Command: [npm start          ]│
│ Plan: [Free                ▼]       │
└─────────────────────────────────────┘
```

### Step 4: Add Environment Variables

**Click**: "Advanced" → "Add Environment Variable"

**Add these variables from your `.env` file:**

```
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

DATABASE_URL=<MySQL connection string - see Part 3>
REDIS_URL=<Redis connection string - see Part 4>

JWT_SECRET=your_super_secret_jwt_key_min_32_chars
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

CORS_ORIGIN=https://ems.company.com,https://app.company.com

EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=xevntepfhndjlzz2@ethereal.email
SMTP_PASS=P9Jbx5AXVW1csWhhaE
SMTP_FROM=ems@ethereal.email

APP_NAME=EMS
APP_VERSION=1.0.0
API_PREFIX=/api/v1

SESSION_COOKIE_NAME=refreshToken
SESSION_MAX_AGE_DAYS=7

RESET_PASSWORD_TOKEN_TTL_MINUTES=30
FRONTEND_RESET_PASSWORD_URL=https://ems.company.com/reset-password
```

**Screenshot template:**
```
┌─────────────────────────────────────┐
│ Environment Variables                │
├─────────────────────────────────────┤
│ + Add Environment Variable           │
│                                      │
│ NODE_ENV              production     │
│ DATABASE_URL          mysql://...    │
│ REDIS_URL             redis://...    │
│ JWT_SECRET            ****           │
│ SMTP_HOST             smtp.ethereal  │
│ ... (more variables)                 │
└─────────────────────────────────────┘
```

### Step 5: Create Web Service

**Click**: **"Create Web Service"**

**You'll see:**
```
✅ Service created!
📦 Building...
🚀 Deploying...
📍 Your app will be at: https://ems-backend.onrender.com
```

Render will automatically:
- ✅ Clone your GitHub repo
- ✅ Install dependencies (npm install)
- ✅ Run migrations (npm run db:migrate:prod)
- ✅ Start the server (npm start)

---

## PART 3: SETUP MYSQL DATABASE

### Option A: Render MySQL (Easiest)

**In Render Dashboard:**

1. Click **"New +"** → **"MySQL"**

2. **Configuration:**
```
Name:                   ems-mysql
Plan:                   Free
Database:               ems_production
```

3. **After creation, you'll get:**
```
Internal Database URL:  mysql://user:pass@localhost:3306/...
External Database URL:  mysql://user:pass@host.onrender.com:3306/...
```

4. **Copy the External URL** → Paste as `DATABASE_URL` in Web Service environment variables

5. **Run migrations:**
   - Migrations run automatically on first deploy
   - Or manually: `npm run db:migrate:prod`

6. **View database:**
   - Use database client like MySQL Workbench
   - Connect with External URL from Render

**Screenshot template:**
```
┌──────────────────────────────────┐
│ MySQL Database Info              │
├──────────────────────────────────┤
│ Host: mysql-xyz.onrender.com    │
│ Port: 3306                       │
│ User: admin                      │
│ Password: ****                   │
│ Database: ems_production         │
│                                  │
│ External URL: mysql://...        │
│ (Copy this to DATABASE_URL)      │
└──────────────────────────────────┘
```

### Option B: AWS RDS MySQL (More Production)

**On AWS Console:**

1. **RDS** → **Create Database**

2. **Configuration:**
```
Engine:              MySQL 8.0
Instance:            db.t3.micro (free tier)
DB Name:             ems_production
Master Username:     admin
Master Password:     (strong password, 20+ chars)
Publicly Accessible: Yes
```

3. **Connection String:**
```
mysql://admin:password@ems-prod.c123.us-east-1.rds.amazonaws.com:3306/ems_production
```

4. **Paste as `DATABASE_URL`** in Render Web Service

5. **Security Group:**
   - Allow port 3306
   - From: Render IP (find in Render settings)

---

## PART 4: SETUP REDIS

### Option A: Render Redis (Free)

**In Render Dashboard:**

1. Click **"New +"** → **"Redis"**

2. **Configuration:**
```
Name:    ems-redis
Plan:    Free
```

3. **After creation:**
```
Internal Connection String: redis://localhost:6379
External Connection String: redis://:pass@host:port
```

4. **Copy External URL** → Paste as `REDIS_URL`

**Screenshot template:**
```
┌──────────────────────────────────┐
│ Redis Instance                   │
├──────────────────────────────────┤
│ Host: redis-xyz.onrender.com    │
│ Port: 6379                       │
│ Password: ****                   │
│                                  │
│ Connection: redis://:pass@...    │
│ (Copy this to REDIS_URL)         │
└──────────────────────────────────┘
```

### Option B: Redis Cloud (Also Free)

1. Visit: https://redis.com/try-free
2. Create account
3. Create database
4. Copy connection string: `redis://:password@host:port`
5. Paste as `REDIS_URL`

---

## PART 5: UPDATE ENVIRONMENT VARIABLES

**After creating MySQL and Redis:**

1. Go back to **Web Service** (ems-backend)
2. Click **"Environment"**
3. **Update these:**
   - `DATABASE_URL` = Your MySQL connection string
   - `REDIS_URL` = Your Redis connection string
4. Click **"Save"**
5. Render will **automatically redeploy**

**Watch the Logs:**
- Click **"Logs"** tab
- Wait for "Server started" message

---

## PART 6: VERIFY DEPLOYMENT

### Health Check (After server starts)

```bash
# In your terminal
curl https://ems-backend.onrender.com/health

# Expected response:
{"status":"ok"}
```

### View Logs

**In Render Dashboard:**
1. Select your Web Service
2. Click **"Logs"** tab
3. You should see:
```
⚙️  Server started
✅ App Name: EMS
✅ Port: 3000
✅ Environment: production
✅ Docs URL: https://ems-backend.onrender.com/docs
```

### Test API

```bash
# Login endpoint
curl -X POST https://ems-backend.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-key: acme" \
  -d '{"email":"user@company.com","password":"password"}'

# Expected: MFA challenge with OTP
{
  "success": true,
  "data": {
    "mfaRequired": true,
    "challengeId": "...",
    "destinationMasked": "u***@company.com"
  }
}
```

### Check Database Connection

**In Render Console:**
```bash
# Connect to MySQL
npm run db:studio

# This opens Prisma Studio to browse your database
# Verify tables were created:
- User
- Employee
- Department
- LeaveRequest
- AttendanceRecord
- Holiday
- (and 8 more tables)
```

---

## PART 7: CONFIGURE AUTO-DEPLOY (Optional)

**Setup automatic deploys on every push:**

1. In Render Web Service settings
2. Click **"Auto-Deploy"**
3. Select branch: **main**
4. Enable: **"Auto-deploy on push"**

Now every time you push to GitHub:
- ✅ Render automatically rebuilds
- ✅ Runs tests and migrations
- ✅ Deploys new version

---

## TROUBLESHOOTING

### Issue: "Build failed"

**Check logs for:**
- Missing dependencies (npm install issue)
- Migration error (database connection)
- Environment variable missing

**Fix:**
```bash
# From your machine
npm install
npm run db:migrate:prod

# Then push to GitHub (Render will rebuild)
git push origin main
```

### Issue: "Cannot connect to database"

**Verify:**
1. Database is running
2. `DATABASE_URL` is correct in environment
3. Security group allows Render IP
4. Credentials are correct

**Test locally first:**
```bash
mysql -u admin -p -h your-host.rds.amazonaws.com -e "SELECT 1"
```

### Issue: "Redis connection refused"

**Check:**
1. Redis is running
2. `REDIS_URL` matches your Redis instance
3. Port is accessible (usually 6379)

**Test:**
```bash
redis-cli -u "redis://:pass@host:port" ping
# Should return: PONG
```

### Issue: "OTP emails not sending"

**Verify:**
1. `SMTP_HOST` = `smtp.ethereal.email`
2. `SMTP_USER` and `SMTP_PASS` are correct
3. Redis is running (BullMQ queue needs Redis)

**Test:**
```bash
npm run email:test -- --to your-email@company.com
```

---

## MONITORING & LOGS

### View Real-time Logs

```
Render Dashboard
  ↓
Your Web Service (ems-backend)
  ↓
"Logs" tab
  ↓
Scroll to see all activity
```

### Common Log Messages

```
✅ Server started                    (Good - app is running)
⚠️  Warning: Slow query (1234ms)   (Check database)
❌ Error: Cannot connect to DB      (Check DATABASE_URL)
📊 HTTP Request: POST /api/v1/auth  (API activity)
```

### Metrics

Monitor in Render Dashboard:
- **CPU Usage** - Should be < 50% at rest
- **Memory** - Should be < 500MB
- **Disk** - Track usage
- **Request Count** - Spikes indicate traffic

---

## ESTIMATED TIMELINE

| Task | Time |
|------|------|
| Push to GitHub | 2 min |
| Create Web Service | 3 min |
| Add Environment Variables | 3 min |
| Create MySQL Database | 5 min |
| Create Redis Instance | 5 min |
| Update Web Service env vars | 2 min |
| Render build & deploy | 5-10 min |
| **TOTAL** | **25-30 min** |

---

## URLS YOU'LL NEED

### After Deployment

```
Web Service (API):
https://ems-backend.onrender.com

API Documentation:
https://ems-backend.onrender.com/docs

Health Check:
https://ems-backend.onrender.com/health

Example Login:
POST https://ems-backend.onrender.com/api/v1/auth/login
```

### External Dashboards

```
GitHub Repo:
https://github.com/saeedafri/Employee-management-system

Render Services:
https://dashboard.render.com

MySQL Database (if using Render):
https://dashboard.render.com → MySQL

Redis Instance (if using Render):
https://dashboard.render.com → Redis

AWS RDS (if using AWS):
https://console.aws.amazon.com/rds
```

---

## NEXT STEPS

After deployment is complete:

1. ✅ Share API URL with frontend team
2. ✅ Share API docs: `API_DOCUMENTATION.md`
3. ✅ Test API endpoints together
4. ✅ Monitor Render logs for errors
5. ✅ Load test before going to production

---

## FINAL CHECKLIST

- [ ] Code pushed to GitHub
- [ ] Web Service created on Render
- [ ] Environment variables configured
- [ ] MySQL database created
- [ ] Redis instance created
- [ ] Database URL updated in Web Service
- [ ] Redis URL updated in Web Service
- [ ] Build and deployment successful
- [ ] Health endpoint responding
- [ ] API endpoints testing
- [ ] Database tables verified
- [ ] Logs showing "Server started"

---

**You're now ready for production!** 🚀

Have questions? Check:
- `DEPLOYMENT_GUIDE.md` - Full deployment guide
- `API_DOCUMENTATION.md` - API reference
- `README_FINAL_STATUS.md` - Project overview
