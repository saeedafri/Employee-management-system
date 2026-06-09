#!/usr/bin/env bash
# seedAll.sh — run every seed in correct order, stop on first failure
# Uses connection_limit=1 to avoid exhausting Render's connection pool.
set -e

cd "$(dirname "$0")/.."

# Build DB URL with connection_limit=1 to avoid P1017 on Render free-tier
BASE_URL=$(node -e "
const fs = require('fs');
const lines = fs.readFileSync('.env','utf8').split('\n');
const line = lines.find(l => l.startsWith('DATABASE_URL='));
const url = line.replace('DATABASE_URL=','').replace(/^\"|\"$/g,'').trim();
const sep = url.includes('?') ? '&' : '?';
console.log(url + sep + 'connection_limit=1&pool_timeout=30');
")
export DATABASE_URL="$BASE_URL"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          EMS — Full Database Seed (all modules)          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "DB: ${DATABASE_URL:0:60}..."
echo ""

run_seed() {
  local label="$1"
  local file="$2"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "▶  $label"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  node "$file"
  echo ""
}

run_seed "1/7  Base Seed"            "prisma/seed.js"
run_seed "2/7  Comprehensive Seed"   "prisma/seedComprehensive.js"
run_seed "3/7  UI Data Seed"         "prisma/seedUIData.js"
run_seed "4/7  Demo Seed"            "prisma/seedDemo.js"
run_seed "5/7  Phase 3 Rich Seed"    "prisma/seedPhase3Rich.js"
run_seed "6/7  Timesheets Seed"      "prisma/seedTimesheets.js"
run_seed "7/7  Payroll Phase 3 Seed" "prisma/seedPayrollPhase3.js"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║                ✅  All seeds complete!                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
