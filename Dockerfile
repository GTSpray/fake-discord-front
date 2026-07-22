FROM mcr.microsoft.com/playwright:v1.61.1-noble

ENV NODE_ENV=production \
    CAPTURE_BASE_URL=https://gtspray.github.io/fake-discord-front/ \
    CAPTURE_VIDEO_FORMAT=gif \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# ffmpeg converts Playwright WebM recordings to gif / mp4 (webm can be kept as-is).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g playwright@1.61.1 \
  && mkdir -p /app/node_modules \
  && ln -sf /usr/lib/node_modules/playwright /app/node_modules/playwright

COPY scripts /app/scripts
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

WORKDIR /work

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["help"]
