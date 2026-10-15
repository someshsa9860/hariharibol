#!/bin/bash

# Everything the scripts need to know: where things are, which images, how much memory.
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$BASE_DIR/server/.env"
SECRETS_DIR="$BASE_DIR/secrets"
WEBSITE_DIR="$BASE_DIR/website"

# The containers talk to each other (redis) by name on this network. Only the
# loopback ports below are published; Apache/Nginx on the host proxies to them.
NETWORK="hariharibol"

AWS_REGION="ap-south-1"
ECR_REGISTRY="572638914162.dkr.ecr.ap-south-1.amazonaws.com"
IMAGE_TAG="${IMAGE_TAG:-latest}"
BACKEND_IMAGE="$ECR_REGISTRY/hariharibol-backend:$IMAGE_TAG"
ADMIN_IMAGE="$ECR_REGISTRY/hariharibol-admin:$IMAGE_TAG"
WEBSITE_IMAGE="nginx:1.27-alpine"
REDIS_IMAGE="redis:7-alpine"

# Memory limits come from what the containers actually used (cgroup peak after a
# day in production: api 160 MiB, worker 116, socket 60, deeplink 41, redis 40,
# the two nginx containers under 10), with room for traffic the sample did not
# see. The database is managed (RDS), so there is no postgres container.
#
# *_HEAP_MB is Node's own heap ceiling, about 60% of the limit. Without it Node
# grows until the kernel kills the container; with it Node collects garbage
# first. The rest of the limit is for what the heap does not count (the Prisma
# engine, buffers, the runtime). Raise a limit and its heap together.
# Each container's swap is capped at its memory, so one that misbehaves cannot
# push the whole server into swap.

API_MEMORY="512m"
API_HEAP_MB="320"
API_CPU="1.0"

WORKER_MEMORY="512m"
WORKER_HEAP_MB="320"
WORKER_CPU="1.0"

SOCKET_MEMORY="256m"
SOCKET_HEAP_MB="160"
SOCKET_CPU="0.5"

DEEPLINK_MEMORY="128m"
DEEPLINK_HEAP_MB="80"
DEEPLINK_CPU="0.5"

ADMIN_MEMORY="64m"
ADMIN_CPU="0.5"

WEBSITE_MEMORY="64m"
WEBSITE_CPU="0.25"

# Redis refuses writes at REDIS_MAXMEMORY instead of growing into its limit.
# "noeviction" is deliberate: the job queue must never lose a job to make room.
REDIS_MEMORY="128m"
REDIS_MAXMEMORY="64mb"
REDIS_CPU="0.5"

# The migration runs in its own throwaway container (see migrate.sh).
MIGRATE_MEMORY="768m"
