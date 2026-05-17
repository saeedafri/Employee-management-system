# EMS Backend Deployment on Oracle Cloud Always Free

## Overview
This guide provides step-by-step instructions for deploying the EMS backend to Oracle Cloud's Always Free tier using:
- Virtual Cloud Network (VCN) with public/private subnets
- MySQL HeatWave Database
- Redis (separate compute instance)
- Nginx reverse proxy
- SSL/TLS with Let's Encrypt

## Prerequisites
- Oracle Cloud Always Free account
- Domain name (for SSL certificates)
- SSH key pair generated locally
- Local terminal with `ssh`, `scp` commands

## PART 1: Virtual Cloud Network (VCN) Setup

### Create VCN
1. Open Oracle Cloud Console → Networking → Virtual Cloud Networks
2. Click "Start VCN Wizard"
3. Select "VCN with Internet Connectivity"
4. Configure:
   - Name: `ems-vcn`
   - CIDR: `10.0.0.0/16`
   - Public Subnet CIDR: `10.0.1.0/24`
   - Private Subnet CIDR: `10.0.2.0/24`
   - Use NAT Gateway: Yes
5. Click "Next" and "Create"

### Configure Security Lists
1. Navigate to VCN → Security Lists → Default Security List
2. Ingress Rules Add:
   - Port 22 (SSH): Source `0.0.0.0/0`
   - Port 80 (HTTP): Source `0.0.0.0/0`
   - Port 443 (HTTPS): Source `0.0.0.0/0`
   - Port 3000 (App): Source `10.0.0.0/16` (internal only)

3. Navigate to Private Subnet Security List
4. Ingress Rules Add:
   - Port 3306 (MySQL): Source `10.0.0.0/16`
   - Port 6379 (Redis): Source `10.0.0.0/16`

## PART 2: MySQL HeatWave Setup

### Create MySQL Database
1. Open Oracle Cloud Console → Databases → MySQL HeatWave
2. Click "Create DB System"
3. Configure:
   - Display Name: `ems-mysql`
   - MySQL Version: 8.0 (latest)
   - Admin Username: `admin`
   - Admin Password: (Set strong password)
   - Shape: MySQL.VM.Standard.E2.1.Micro (Always Free eligible)
   - VCN: `ems-vcn`
   - Subnet: `ems-vcn-private-subnet`
   - Enable Backup: Yes
4. Click "Create"

### Wait for creation (5-10 minutes)

### Configure MySQL Access
```bash
# From your app compute instance, test connection:
mysql -h <MYSQL_PRIVATE_IP> -u admin -p ems_db

# Create application database:
CREATE DATABASE ems_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ems_user'@'%' IDENTIFIED BY 'StrongPassword123!@';
GRANT ALL ON ems_db.* TO 'ems_user'@'%';
FLUSH PRIVILEGES;
```

## PART 3: Compute Instance Setup (App + Nginx)

### Create Compute Instance
1. Open Oracle Cloud Console → Compute → Instances
2. Click "Create Instance"
3. Configure:
   - Image: Ubuntu 22.04 LTS
   - Shape: Ampere (Always Free eligible) or Standard.E2.1.Micro
   - VCN: `ems-vcn`
   - Subnet: `ems-vcn-public-subnet`
   - SSH Key: Upload or create new key pair
4. Click "Create"

### SSH into Instance
```bash
ssh ubuntu@<public_ip> -i your-key.pem
```

### Install Node.js and PM2
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2
sudo npm install -g yarn

# Verify
node --version  # v22.x.x
npm --version   # 11.x.x
```

### Install Nginx
```bash
sudo apt install -y nginx

# Start and enable
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Clone and Setup EMS Backend
```bash
cd /opt
sudo git clone https://github.com/yourorg/employee-management-system-backend.git ems
cd ems
sudo chown -R ubuntu:ubuntu .

# Install dependencies
npm install

# Create .env
cp .env.example .env
# Edit .env with:
NODE_ENV=production
DATABASE_URL=mysql://ems_user:password@<mysql_private_ip>:3306/ems_db
REDIS_URL=redis://<redis_private_ip>:6379
JWT_SECRET=<generate-strong-secret>
FRONTEND_RESET_PASSWORD_URL=https://yourdomain.com/reset-password
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<brevo-email>
SMTP_PASS=<brevo-api-key>
SMTP_FROM=noreply@yourdomain.com
EMAIL_PROVIDER=smtp
```

### Setup PM2
```bash
# Start app with PM2
pm2 start npm --name "ems-app" -- start

# Save PM2 config
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Verify app is running
pm2 list
curl http://localhost:3000/api/v1/health
```

## PART 4: Redis Setup (Separate Instance)

### Create Redis Compute Instance
1. Create another Compute Instance (same as app, but for Redis)
2. SSH and install Redis:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Redis
sudo apt install -y redis-server

# Configure for network access
sudo nano /etc/redis/redis.conf
# Change:
# bind 127.0.0.1 -> bind 0.0.0.0
# requirepass <set-strong-password>

# Restart Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Verify
redis-cli ping  # Should return PONG
```

### Test Redis Connection from App Instance
```bash
redis-cli -h <redis_private_ip> -a <password> ping
```

## PART 5: Nginx Reverse Proxy Configuration

```bash
# On app instance, configure Nginx
sudo tee /etc/nginx/sites-available/ems-api > /dev/null << 'EOF'
upstream ems_app {
  server 127.0.0.1:3000;
}

server {
  listen 80;
  server_name yourdomain.com www.yourdomain.com;

  # Redirect HTTP to HTTPS
  location / {
    return 301 https://$server_name$request_uri;
  }

  # Let's Encrypt validation
  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }
}

server {
  listen 443 ssl http2;
  server_name yourdomain.com www.yourdomain.com;

  ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

  # SSL Configuration
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 10m;

  # Security Headers
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header X-XSS-Protection "1; mode=block" always;

  location / {
    proxy_pass http://ems_app;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 90;
    proxy_connect_timeout 90;
  }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/ems-api /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

## PART 6: SSL/TLS with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Create certbot directory
sudo mkdir -p /var/www/certbot

# Get certificate
sudo certbot certonly --webroot -w /var/www/certbot \
  -d yourdomain.com -d www.yourdomain.com \
  --agree-tos --no-eff-email

# Auto-renewal (already configured)
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Verify renewal
sudo certbot renew --dry-run
```

## PART 7: Database Migration and Setup

```bash
# On app instance
cd /opt/ems

# Run migrations
npm run db:migrate:prod

# Seed initial data (optional)
npm run db:seed

# Verify connection
npm test
```

## PART 8: Health Check and Verification

```bash
# Check application health
curl -k https://yourdomain.com/api/v1/health

# Check PM2 logs
pm2 logs ems-app

# Monitor system
pm2 monit

# Check Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting

### MySQL Connection Issues
```bash
# Test from app instance
mysql -h <private_ip> -u ems_user -p ems_db

# Check MySQL logs on database instance
mysql -u admin -p -e "SHOW VARIABLES LIKE 'port';"

# Verify security list allows 3306
```

### Redis Connection Issues
```bash
# Test Redis connection
redis-cli -h <private_ip> -a <password> ping

# Check Redis logs
sudo tail -f /var/log/redis/redis-server.log
```

### Nginx SSL Issues
```bash
# Check certificate
sudo openssl x509 -in /etc/letsencrypt/live/yourdomain.com/fullchain.pem -text

# Check Nginx configuration
sudo nginx -t -v

# Reload Nginx
sudo systemctl reload nginx
```

### App Not Starting
```bash
# Check PM2 logs
pm2 logs ems-app --err

# Check if port 3000 is in use
sudo netstat -tulpn | grep 3000

# Kill and restart
pm2 kill
pm2 start npm --name "ems-app" -- start
```

### Network Connectivity
```bash
# Test MySQL from app instance
nc -zv <mysql_private_ip> 3306

# Test Redis from app instance
nc -zv <redis_private_ip> 6379

# Check security lists on both VCN and subnet
```

## Performance Tuning

### MySQL HeatWave
```sql
-- Enable HeatWave
CALL sys.heatwave_load(JSON_ARRAY('ems_db'));

-- Check loaded tables
SELECT * FROM information_schema.HEATWAVE_TABLES;
```

### Redis Memory Management
```bash
# Monitor memory usage
redis-cli INFO memory

# Set maxmemory policy (in redis.conf)
maxmemory 256mb
maxmemory-policy allkeys-lru
```

### Nginx Caching
Add to Nginx config:
```nginx
# Cache static assets
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}
```

## Backup and Recovery

### MySQL Backups
```bash
# Automatic backups enabled via Oracle MySQL service
# Download backup from Console → MySQL → Backups

# Manual backup
mysqldump -h <ip> -u admin -p ems_db > backup.sql
```

### Redis Persistence
```bash
# Check Redis persistence
redis-cli CONFIG GET save
redis-cli CONFIG GET appendonly

# Manual save
redis-cli BGSAVE
```

## Monitoring

### Set up Monitoring with Oracle Cloud
1. Compute Instance Monitoring:
   - Memory utilization
   - CPU utilization
   - Network I/O

2. MySQL Monitoring:
   - Connections
   - Query performance
   - Disk space

3. PM2 Monitoring:
   ```bash
   pm2 monit
   ```

## Scaling Considerations

- **Load Balancing**: Add multiple app instances behind Nginx
- **Database**: Scale MySQL to larger instance if needed
- **Redis**: Cluster Redis for higher throughput
- **Storage**: Increase MySQL storage as database grows

## Cost Estimation (Always Free)
- 2x Compute VM.Standard.E2.1.Micro: Free
- 1x MySQL VM.Standard.E2.1.Micro: Free
- 1x Redis Compute: Free (first instance)
- Total: **Completely Free** (within Always Free limits)

## Security Checklist
- [ ] Security lists configured (22, 80, 443, 3306, 6379)
- [ ] SSH keys secured and backed up
- [ ] Database password strong (20+ chars)
- [ ] Redis password set
- [ ] SSL/TLS certificate installed
- [ ] HTTPS redirect enabled
- [ ] Security headers configured
- [ ] PM2 running as non-root
- [ ] Automatic backups enabled
- [ ] Firewall rules tested

## Support and Debugging

For issues, check:
1. Oracle Cloud Console → Instances → Logs
2. PM2 logs: `pm2 logs`
3. Nginx logs: `/var/log/nginx/error.log`
4. MySQL logs via Console
5. Application logs via PM2

## Next Steps
1. Setup CI/CD pipeline for automatic deployments
2. Configure monitoring and alerting
3. Implement auto-scaling policies
4. Setup backup recovery procedures
5. Document runbooks for operations team
