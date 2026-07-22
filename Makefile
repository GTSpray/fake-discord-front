# Doc Studio — Docker-wrapped dev and CI commands.
#
# Snapshots are always captured inside the dev image. We version GIF files and
# a snapshot.json containing MD5 hashes of per-step PNG captures.

DOCKER_IMAGE ?= doc-studio-dev
CAPTURE_IMAGE ?= doc-studio-capture
DOCKERFILE_DEV ?= docker/Dockerfile.dev
DOCKERFILE_CAPTURE ?= Dockerfile
PLAYWRIGHT_VERSION ?= 1.61.1

# GitHub Actions sets CI=true; keep container root there (Playwright expects it).
ifdef CI
  DOCKER_USER :=
else
  DOCKER_USER := -u $(shell id -u):$(shell id -g)
endif

DOCKER_RUN = docker run --rm $(DOCKER_USER) \
	-e HOME=/tmp \
	-e npm_config_cache=/tmp/.npm \
	-v "$(CURDIR):/app" \
	-w /app \
	$(DOCKER_IMAGE)

.PHONY: help docker-build docker-build-capture install build test lint format-check \
        validate snapshots snapshots-refresh snapshots-refresh-ci snapshots-verify \
        ci ci-fast lint-ci test-ci clean

help:
	@echo "Doc Studio"
	@echo ""
	@echo "  make docker-build          Build the dev/CI image ($(DOCKER_IMAGE))"
	@echo "  make install               npm ci (in Docker)"
	@echo "  make build                 Production build (in Docker)"
	@echo "  make test                  Unit tests (in Docker)"
	@echo "  make lint                  ESLint (in Docker)"
	@echo "  make format-check          Prettier check (in Docker)"
	@echo "  make validate              Validate example JSON files"
	@echo "  make snapshots-refresh     Refresh snapshots (exit 0 if none, 1 if updated; max 2 retries)"
	@echo "  make ci                    Run lint-ci, test-ci, and snapshots-refresh"
	@echo "  make lint-ci               format:check + lint (CI job)"
	@echo "  make test-ci               validate + build + test (CI job)"
	@echo ""
	@echo "  make docker-build-capture  Build remote capture CLI ($(CAPTURE_IMAGE))"

docker-build:
	docker build -f $(DOCKERFILE_DEV) \
		--build-arg PLAYWRIGHT_VERSION=$(PLAYWRIGHT_VERSION) \
		-t $(DOCKER_IMAGE) .

docker-build-capture:
	docker build -f $(DOCKERFILE_CAPTURE) -t $(CAPTURE_IMAGE) .

install: docker-build
	$(DOCKER_RUN) npm ci

build: docker-build
	$(DOCKER_RUN) npm ci
	$(DOCKER_RUN) npm run build

test: docker-build
	$(DOCKER_RUN) npm ci
	$(DOCKER_RUN) npm test

pretty:
	$(DOCKER_RUN) npm ci
	$(DOCKER_RUN) npm run lint
	$(DOCKER_RUN) npm run format

lint: docker-build
	$(DOCKER_RUN) npm ci
	$(DOCKER_RUN) npm run lint

format-check: docker-build
	$(DOCKER_RUN) npm ci
	$(DOCKER_RUN) npm run format:check

validate: docker-build
	$(DOCKER_RUN) npm ci
	$(DOCKER_RUN) npm run validate -- examples/poll-moderator-flow.json examples/say-hello-flow.json examples/gimme-otter.json

lint-ci:
	$(DOCKER_RUN) sh -euc 'npm ci && npm run format:check && npm run lint'

test-ci:
	$(DOCKER_RUN) sh -euc '\
		npm ci && \
		npm run validate -- examples/poll-moderator-flow.json examples/say-hello-flow.json examples/gimme-otter.json && \
		npm run build && \
		npm test \
	'

# Capture in /tmp, update snapshot.json, copy GIF only for evolved scenarios.
# Exit 0 = nothing to refresh. Exit 1 = snapshots were refreshed (commit them).
snapshots-refresh: docker-build
	$(DOCKER_RUN) npm ci
	$(DOCKER_RUN) npm run build
	$(DOCKER_RUN) npm run snapshots:refresh

ci: docker-build lint-ci test-ci snapshots-refresh

ci-fast: lint-ci test-ci snapshots-refresh

clean:
	rm -rf dist node_modules coverage output
