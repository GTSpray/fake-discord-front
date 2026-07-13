FROM mcr.microsoft.com/playwright:v1.52.0-noble

ENV NODE_ENV=production \
    CAPTURE_BASE_URL=https://gtspray.github.io/fake-discord-front/ \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Playwright CLI library only — browsers are already in the base image.
RUN npm install -g playwright@1.52.0 \
  && mkdir -p /app/node_modules \
  && ln -sf /usr/lib/node_modules/playwright /app/node_modules/playwright

COPY scripts /app/scripts
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

WORKDIR /work

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["help"]
