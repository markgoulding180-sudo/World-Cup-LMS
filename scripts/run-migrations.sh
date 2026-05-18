#!/bin/bash
# World Cup LMS - Database Migration Runner
# Usage: ./run-migrations.sh

set -e

echo "World Cup LMS - Database Migration Runner"
echo "=========================================="
echo ""

if [ -z "$SUPABASE_SECRET" ]; then
    echo "❌ SUPABASE_SECRET not set!"
    echo ""
    echo "Please set it first:"
    echo "   export SUPABASE_SECRET=your_service_role_key_here"
    echo ""
    exit 1
fi

echo "✅ SUPABASE_SECRET is set"
echo ""
echo "Running migrations..."
echo ""

cd "$(dirname "$0")/.."
node scripts/run-migrations.js

echo ""
read -p "Press Enter to continue..."
