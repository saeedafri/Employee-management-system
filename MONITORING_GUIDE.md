# EMS Backend - Monitoring & Observability Setup

**Goal**: Proactive monitoring, fast incident response, continuous optimization  
**Stack**: Prometheus, Grafana, Sentry (optional), CloudWatch  

---

## Overview

The EMS backend includes structured logging, metrics collection, and error tracking for production observability.

---

## 1. Application Logging

### Logger Setup

The application uses **Pino** for high-performance structured logging:

```javascript
// src/utils/logger.js
import pino from 'pino';

const pinoConfig = {
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }  // Dev only
  }
};

export const logger = pino(pinoConfig);

// Usage
logger.info({ userId: '123', action: 'LOGIN' });
logger.error({ error: e.message, code: 'DB_ERROR' });
logger.warn({ slowQuery: 'SELECT * took 5s' });
```

### Log Levels

| Level | Use Case |
|-------|----------|
| `debug` | Development only - detailed trace info |
| `info` | Normal operation (login, API calls) |
| `warn` | Recoverable errors (retry, fallback) |
| `error` | Unrecoverable errors (crashes) |
| `fatal` | System shutdown required |

### Structured Logging Format

```json
{
  "level": 30,
  "time": 1621234567890,
  "pid": 12345,
  "hostname": "prod-server-1",
  "msg": "user login successful",
  "userId": "user-123",
  "tenantId": "tenant-456",
  "ipAddress": "192.168.1.1",
  "duration": 234
}
```

### Log Aggregation

#### Ship to Cloud Logging Service

Option A: **AWS CloudWatch**

```javascript
// Add to src/server.js
import { CloudWatchTransport } from 'pino-cloudwatch';

const transport = pino.transport({
  target: 'pino-cloudwatch',
  options: {
    logGroupName: '/ems/production',
    logStreamName: `${process.env.HOSTNAME}`,
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsRegion: process.env.AWS_REGION
  }
});
```

Option B: **Datadog**

```env
# .env.production
DATADOG_API_KEY=your-datadog-api-key
DATADOG_SITE=datadoghq.com
```

```javascript
import { datadogTransport } from 'pino-datadog';
```

---

## 2. Metrics Collection

### Application Metrics

Key metrics to track:

```javascript
// src/middleware/metrics.js
import client from 'prom-client';

// Request count
export const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status']
});

// Request duration
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]  // 100ms, 500ms, 1s, 2s, 5s, 10s
});

// Database query duration
export const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1]  // 10ms to 1s
});

// Active database connections
export const dbConnectionsActive = new client.Gauge({
  name: 'db_connections_active',
  help: 'Active database connections'
});

// Redis queue depth
export const redisQueueDepth = new client.Gauge({
  name: 'redis_queue_depth',
  help: 'Number of jobs in Redis queue',
  labelNames: ['queue']
});

// Email sending errors
export const emailErrors = new client.Counter({
  name: 'email_send_errors_total',
  help: 'Email sending failures',
  labelNames: ['type', 'reason']
});
```

### Instrument Endpoints

```javascript
// src/middleware/metricsMiddleware.js
export function instrumentMetrics(fastify) {
  fastify.addHook('onRequest', (request, reply, done) => {
    request.startTime = Date.now();
    done();
  });

  fastify.addHook('onResponse', (request, reply, done) => {
    const duration = (Date.now() - request.startTime) / 1000;
    
    httpRequestCounter.labels(
      request.method,
      request.url,
      reply.statusCode
    ).inc();
    
    httpRequestDuration.labels(
      request.method,
      request.url
    ).observe(duration);
    
    done();
  });
}
```

### Expose Metrics Endpoint

```javascript
// In src/app.js
fastify.get('/metrics', async (request, reply) => {
  return client.register.metrics();
});

// Prometheus can scrape: http://localhost:3000/metrics
```

---

## 3. Error Tracking with Sentry

### Installation

```bash
npm install @sentry/node @sentry/tracing
```

### Configuration

```javascript
// src/config/sentry.js
import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";

export function initSentry(fastify, config) {
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.env,
    tracesSampleRate: config.isDevelopment ? 1.0 : 0.1,
    beforeSend(event) {
      // Filter sensitive data
      if (event.request) {
        delete event.request.headers['authorization'];
        delete event.request.cookies;
      }
      return event;
    }
  });

  fastify.register(async (fastify) => {
    fastify.addHook('onRequest', Sentry.Handlers.requestHandler());
    fastify.addHook('onError', Sentry.Handlers.errorHandler());
    fastify.addHook('onResponse', Sentry.Handlers.errorHandler());
  });
}
```

### Capture Errors

```javascript
// Automatic: Unhandled exceptions are sent
// Manual: Capture specific errors
try {
  await saveEmployee(data);
} catch (error) {
  Sentry.captureException(error, {
    contexts: {
      operation: { name: 'save_employee' },
      employee: { id: data.id }
    },
    level: 'error'
  });
}
```

---

## 4. Health Checks

### Liveness Probe (Is it running?)

```javascript
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});
```

### Readiness Probe (Is it ready to serve traffic?)

```javascript
fastify.get('/ready', async (request, reply) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    email: await checkEmail()
  };
  
  const allReady = Object.values(checks).every(v => v.ok);
  
  return {
    ready: allReady,
    checks,
    timestamp: new Date().toISOString()
  };
});

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch {
    return { ok: false, error: 'Database unreachable' };
  }
}

async function checkRedis() {
  try {
    await redisClient.ping();
    return { ok: true };
  } catch {
    return { ok: false, error: 'Redis unreachable' };
  }
}
```

### Kubernetes Probes

```yaml
# k8s-deployment.yaml
spec:
  containers:
  - name: ems-api
    livenessProbe:
      httpGet:
        path: /health
        port: 3000
      initialDelaySeconds: 10
      periodSeconds: 10
    
    readinessProbe:
      httpGet:
        path: /ready
        port: 3000
      initialDelaySeconds: 5
      periodSeconds: 5
```

---

## 5. Distributed Tracing

### OpenTelemetry Setup

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto
```

```javascript
// src/instrumentation.js (must run first)
import { NodeTracerProvider } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { JaegerExporter } from "@opentelemetry/exporter-jaeger";

const tracerProvider = new NodeTracerProvider();
const exporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces'
});
tracerProvider.addSpanProcessor(
  new BatchSpanProcessor(exporter)
);

tracerProvider.register();
```

### Trace Key Operations

```javascript
// Trace database queries
const span = tracer.startSpan('db.query.employee.list');
try {
  const employees = await prisma.employee.findMany();
  span.setAttributes({
    'db.statement': 'SELECT * FROM employee',
    'db.rows_returned': employees.length
  });
} catch (error) {
  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR });
}
span.end();
```

---

## 6. Performance Monitoring Dashboards

### Grafana Dashboard Setup

```bash
# Install Prometheus + Grafana (Docker)
docker run -d --name prometheus \
  -p 9090:9090 \
  -v prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus

docker run -d --name grafana \
  -p 3001:3000 \
  grafana/grafana
```

### Key Metrics to Dashboard

```
1. Request Rate (requests/second)
   - By endpoint
   - By status code
   - By method (GET, POST, etc)

2. Latency (response time)
   - p50, p95, p99 percentiles
   - By endpoint
   - Trend over time

3. Error Rate
   - Errors per minute
   - By type (4xx, 5xx)
   - By endpoint

4. Database Performance
   - Query count per second
   - Query duration (p95)
   - Connection pool utilization

5. Redis Queue
   - Jobs queued
   - Jobs completed
   - Failed jobs
   - Processing time

6. System Resources
   - CPU usage
   - Memory usage
   - Disk I/O
   - Network bandwidth

7. Business Metrics
   - Login attempts
   - Leave requests submitted
   - Attendance check-ins
   - Export jobs completed
```

---

## 7. Alerting Rules

### Prometheus Alert Rules

```yaml
# prometheus-rules.yml
groups:
- name: ems-alerts
  rules:
  
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
    for: 5m
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }} errors/sec"
  
  - alert: SlowRequests
    expr: histogram_quantile(0.95, http_request_duration_seconds) > 2
    for: 10m
    annotations:
      summary: "Slow API responses"
      description: "95th percentile: {{ $value }}s"
  
  - alert: DatabaseDown
    expr: up{job="database"} == 0
    for: 1m
    annotations:
      summary: "Database is down"
      description: "Database unreachable for more than 1 minute"
  
  - alert: HighQueueDepth
    expr: redis_queue_depth > 1000
    for: 5m
    annotations:
      summary: "Email queue backlog"
      description: "{{ $value }} jobs waiting to be processed"
  
  - alert: LowDiskSpace
    expr: node_filesystem_avail / node_filesystem_size < 0.1
    for: 5m
    annotations:
      summary: "Low disk space"
      description: "Only {{ $value | humanizePercentage }} available"
```

### Alert Channels

Configure notifications to:
- **Slack**: #incidents channel
- **PagerDuty**: For on-call engineers
- **Email**: ops-team@company.com
- **SMS**: Critical alerts only

---

## 8. Log Analysis Queries

### Find Slow Queries

```sql
SELECT 
  query,
  COUNT(*) as count,
  AVG(duration) as avg_duration,
  MAX(duration) as max_duration
FROM logs
WHERE level = 'warn'
  AND message LIKE '%slow query%'
  AND timestamp > NOW() - INTERVAL 1 HOUR
GROUP BY query
ORDER BY avg_duration DESC;
```

### Find Failed OTP Attempts

```sql
SELECT 
  user_id,
  COUNT(*) as failed_attempts,
  MAX(timestamp) as last_attempt
FROM logs
WHERE message = 'OTP_VERIFICATION_FAILED'
  AND timestamp > NOW() - INTERVAL 1 DAY
GROUP BY user_id
HAVING COUNT(*) > 5;  -- Locked out after 5 attempts
```

### Database Connection Pool Usage

```sql
SHOW PROCESSLIST;
SELECT COUNT(*) as active_connections FROM information_schema.processlist;
```

---

## 9. Incident Response

### Alert Notification Flow

```
Alert triggered
  ↓
Grafana/Sentry → Slack notification
  ↓
On-call engineer receives alert
  ↓
Acknowledge alert (auto-triggers runbook)
  ↓
Execute remediation steps
  ↓
Resolve incident
  ↓
Post-mortem analysis
```

### Common Issues & Remediation

| Alert | Cause | Solution |
|-------|-------|----------|
| High error rate | Bug in deploy | Rollback, check logs, revert commit |
| Slow requests | DB query timeout | Kill long queries, add index, scale DB |
| Database down | Connection loss | Restart MySQL, check security group |
| Memory leak | Unbounded cache | Restart service, implement cache TTL |
| Queue backlog | Email service slow | Check SMTP, scale worker concurrency |

---

## 10. Continuous Monitoring Commands

### Real-time Log Streaming

```bash
# Tail production logs
pm2 logs ems-api

# Filter for errors
tail -f logs/app.log | grep ERROR

# Follow with Kubernetes
kubectl logs -f deployment/ems-api
```

### Database Health Checks

```bash
# Check connection pool
mysql> SHOW PROCESSLIST;

# Check query performance
mysql> SELECT * FROM mysql.slow_log LIMIT 10;

# Check table sizes
mysql> SELECT 
  table_name,
  ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
FROM information_schema.TABLES
WHERE table_schema = 'ems_production'
ORDER BY size_mb DESC;
```

### Redis Queue Monitoring

```bash
# Monitor job queue
redis-cli -u $REDIS_URL LLEN bullmq:email:*

# Watch job status
redis-cli -u $REDIS_URL XLEN bullmq:email:

# Check failed jobs
redis-cli -u $REDIS_URL ZRANGE bullmq:email:failed 0 -1 WITHSCORES
```

---

## 11. Performance Benchmarking

### Load Testing

```bash
# Install Apache Bench
ab -n 1000 -c 10 https://api.ems.company.com/health

# Or with wrk
wrk -t4 -c100 -d30s https://api.ems.company.com/api/v1/employees
```

### Expected Baseline Performance

| Endpoint | p50 | p95 | p99 |
|----------|-----|-----|-----|
| GET /health | 10ms | 20ms | 50ms |
| GET /employees | 50ms | 150ms | 300ms |
| POST /leave/requests | 80ms | 200ms | 500ms |
| POST /attendance/check-in | 100ms | 300ms | 800ms |

### Track Performance Trends

```bash
# Monthly benchmark script
npm run perf:api > benchmarks/$(date +%Y-%m-%d).txt
git add benchmarks/
git commit -m "perf: monthly benchmark results"
```

---

## 12. Monitoring Checklist

Weekly:
- [ ] Review error rate trends
- [ ] Check database query performance
- [ ] Verify backup completion
- [ ] Analyze slow endpoint logs

Monthly:
- [ ] Performance benchmarking
- [ ] Alert threshold review
- [ ] Capacity planning
- [ ] Security audit logs

Quarterly:
- [ ] Disaster recovery test
- [ ] Database optimization
- [ ] Dependency updates
- [ ] Architecture review

---

## Example: Complete Monitoring Stack

### Docker Compose Setup

```yaml
# docker-compose.monitoring.yml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus
    ports: ['9090:9090']
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus

  grafana:
    image: grafana/grafana
    ports: ['3001:3000']
    volumes:
      - grafana-data:/var/lib/grafana

  jaeger:
    image: jaegertracing/all-in-one
    ports: ['16686:16686', '14268:14268']

volumes:
  prometheus-data:
  grafana-data:
```

```bash
# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up

# Access dashboards
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001 (admin/admin)
# Jaeger: http://localhost:16686
```

---

## Resources

- **Prometheus**: https://prometheus.io/docs
- **Grafana**: https://grafana.com/docs
- **Sentry**: https://docs.sentry.io
- **OpenTelemetry**: https://opentelemetry.io/docs
- **Pino Logger**: https://getpino.io

---

**Monitoring Setup Complete!** 📊

Your EMS backend now has comprehensive observability for production reliability and continuous optimization.
