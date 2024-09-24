#!/usr/bin/env python3

import os
import sys

# Load environment variables from .env file if they are not already set
with open('.env') as f:
    for line in f:
        # Skip comments and empty lines
        if line.startswith('#') or line.strip() == '':
            continue
        key, value = line.strip().split('=', 1)
        if key in os.environ:
            print(f"override from os: {key}")
        if key not in os.environ:
            os.environ[key] = value
            print(f"reading from .env: {key}")

# Path to the SQL file
sql_file_path = 'mysql-init/grant-privileges.sql'

# Get MYSQL_USER from environment variables
MYSQL_USER = os.environ.get('DB_USER')

if not MYSQL_USER:
    print("Environment variable DB_USER is not set.")
    sys.exit(1)

databases = ['vnode1', 'vnode2', 'vnode3']

lines = []

# Grant all permissions to each test database
for db in databases:
    lines.append(f"CREATE DATABASE {db} CHARACTER SET utf8 COLLATE utf8_general_ci;")
    lines.append(f"GRANT ALL PRIVILEGES ON {db}.* TO '{MYSQL_USER}'@'%';")

# Apply changes
lines.append("FLUSH PRIVILEGES;")

# Write the SQL commands to the file
os.makedirs(os.path.dirname(sql_file_path), exist_ok=True)
with open(sql_file_path, 'w') as f:
    f.write('\n'.join(lines))

# Output the final generated SQL
print(f"FINAL GENERATED SQL: {sql_file_path}")
with open(sql_file_path, 'r') as f:
    print(f.read())
