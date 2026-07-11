#!/bin/bash
echo "=== Checking PostgreSQL Audit Database Configuration ==="
echo ""
echo "Checking .env file for audit database variables:"
grep -E "^(AUDIT_DB_|PG_)" .env 2>/dev/null || echo "No AUDIT_DB_ or PG_ variables found in .env"
echo ""
echo "Checking if variables are exported in current environment:"
env | grep -E "^(AUDIT_DB_|PG_)" || echo "No AUDIT_DB_ or PG_ variables in environment"
