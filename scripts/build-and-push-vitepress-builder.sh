#!/bin/sh
set -eu

IMAGE="${1:-192.168.0.242:5000/docs/ai-docs-vitepress-builder:latest}"

docker buildx build \
  --platform linux/amd64 \
  --provenance=false \
  --output=type=image,push=true,oci-mediatypes=false \
  -f Dockerfile.vitepress-builder \
  -t "$IMAGE" \
  .
