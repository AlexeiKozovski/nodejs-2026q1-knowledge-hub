# Thin wrapper: official Qdrant image + curl for Compose HTTP healthchecks.
FROM qdrant/qdrant:v1.12.5

USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
