# The whole service is dependency-free Node, so the image is just the runtime
# and the source. Runs anywhere that takes a container (Cloud Run, Fly,
# Railway, a VPS).
#
#   docker build -t plugin-suite-billing services/billing
#   docker run -p 8787:8787 --env-file services/billing/.env \
#     -v billing-data:/data plugin-suite-billing

# Matches the node-version CI actually runs services/billing/test/e2e.mjs
# under (.github/workflows/validate.yml) — the deployed image should never
# be a Node major CI has never exercised.
# Pinned by digest: a floating tag can change under you between builds.
# This is node 20-alpine as of 2026-04; update tag and digest together.
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293

WORKDIR /srv/billing
COPY package.json server.js catalog.js ./
COPY lib ./lib

RUN mkdir /data && chown node:node /data
ENV BILLING_STORE_FILE=/data/store.json
VOLUME /data

USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://localhost:8787/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
