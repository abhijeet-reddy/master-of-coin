#!/bin/bash
set -e

# Master of Coin - Database Initialization Script
# This script creates the database, runs migrations, and loads seed data

echo "🚀 Master of Coin - Database Initialization"
echo "==========================================="

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Default values
DB_USER="${POSTGRES_USER:-postgres}"
DB_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
DB_NAME="${POSTGRES_DB:-master_of_coin}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

echo "📋 Configuration:"
echo "  Database: $DB_NAME"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  User: $DB_USER"
echo ""

# Check if PostgreSQL is running
echo "🔍 Checking PostgreSQL connection..."
if ! pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER > /dev/null 2>&1; then
    echo "❌ Error: PostgreSQL is not running or not accessible"
    echo "   Please start PostgreSQL and try again"
    exit 1
fi
echo "✅ PostgreSQL is running"
echo ""

# Create database if it doesn't exist
echo "🗄️  Creating database..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $DB_NAME"
echo "✅ Database ready"
echo ""

# Enable UUID extension
echo "🔌 Enabling UUID extension..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"" > /dev/null
echo "✅ UUID extension enabled"
echo ""

# Run migrations
echo "📦 Running migrations..."
cd backend
export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"

if command -v sqlx &> /dev/null; then
    sqlx migrate run
    echo "✅ Migrations completed"
else
    echo "⚠️  Warning: sqlx-cli not found. Skipping migrations."
    echo "   Install with: cargo install sqlx-cli --no-default-features --features postgres"
fi
cd ..
echo ""

# Load seed data
echo "🌱 Loading seed data..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f backend/scripts/seed.sql > /dev/null
echo "✅ Seed data loaded"
echo ""

echo "🎉 Database initialization complete!"
echo ""
echo "📊 Database Summary:"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
    (SELECT COUNT(*) FROM users) as users,
    (SELECT COUNT(*) FROM categories) as categories,
    (SELECT COUNT(*) FROM accounts) as accounts,
    (SELECT COUNT(*) FROM people) as people,
    (SELECT COUNT(*) FROM transactions) as transactions,
    (SELECT COUNT(*) FROM budgets) as budgets;
"
echo ""
echo "🔐 Test User Credentials:"
echo "  Username: little-finger"
echo "  Email: little-finger@master-of-coin.com"
echo "  Password: knowledge-is-power"
echo ""
echo "✨ Ready to start the backend server!"