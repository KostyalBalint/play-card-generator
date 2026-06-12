#!/bin/sh
set -e

# Apply pending migrations before starting. Uses --schema so prisma.config.ts
# (and its TS/dotenv deps) are not required in the slim runtime image.
echo "Running database migrations..."
node prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma

echo "Starting server..."
exec "$@"
