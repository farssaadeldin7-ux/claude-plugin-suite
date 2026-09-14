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
FROM node:20-alpine

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
