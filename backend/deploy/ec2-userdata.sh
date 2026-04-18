#!/bin/bash
set -e

# VaxAI Vision — EC2 Bootstrap Script
# Installs Docker, clones repo, starts services

exec > /var/log/vaxai-deploy.log 2>&1

echo "=== VaxAI Vision Deployment Starting ==="
date

# Update and install Docker
yum update -y
yum install -y docker git
systemctl start docker
systemctl enable docker

# Install Docker Compose v2
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Clone the repo
cd /opt
git clone https://github.com/Simars80/VaxAI-Vision.git
cd VaxAI-Vision/backend

# Create production .env
cat > .env << 'ENVEOF'
ENV=production
DB_PASSWORD=VaxAI_Prod_2026!
REDIS_PASSWORD=VaxAI_Redis_2026!
JWT_SECRET=VaxAI_JWT_$(openssl rand -hex 16)
ENVEOF

# Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# Wait for DB to be ready, then run migrations
sleep 15
docker compose -f docker-compose.prod.yml exec -T api python -c "
from app.database import engine
from app.models import Base
import asyncio

async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('Database tables created successfully')

asyncio.run(init())
" || echo "DB init will be retried on next API request"

# Create demo user
docker compose -f docker-compose.prod.yml exec -T api python scripts/create_demo_user.py || echo "Demo user creation deferred"

echo "=== VaxAI Vision Deployment Complete ==="
date
