# Post Studio: one image runs the API, the web UI and the scheduler.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8080 MEDIA_DIR=/data/media
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl fonts-inter fontconfig && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data/media && chown -R node:node /data /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
COPY --chown=node:node web ./web
# IBM Plex (SIL Open Font Licence) for Claude-designed slides; not packaged in Debian bookworm.
COPY fonts/ibm-plex /usr/local/share/fonts/ibm-plex
RUN fc-cache -f >/dev/null 2>&1 || true
COPY --chown=node:node src/db/migrations ./dist/db/migrations
USER node
EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD curl -fsS http://localhost:8080/healthz || exit 1
CMD ["node", "dist/server.js"]
