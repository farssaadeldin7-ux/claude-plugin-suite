# The whole service is dependency-free Node, so the image is just the runtime
# and the source. Runs anywhere that takes a container (Cloud Run, Fly,
# Railway, a VPS).
#
#   docker build -t plugin-suite-billing services/billing
#   docker run -p 8787:8787 --env-file services/billing/.env \
#     -v billing-data:/data plugin-suite-billing

FROM node:22-alpine

WORKDIR /srv/billing
COPY server.js catalog.js ./
COPY lib ./lib

RUN mkdir /data && chown node:node /data
ENV BILLING_STORE_FILE=/data/store.json
VOLUME /data

USER node
EXPOSE 8787
CMD ["node", "server.js"]
