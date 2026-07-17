# Doc Studio — Docker-wrapped dev and CI commands.
#
# Snapshots are always captured inside the dev image so PNG output is identical
# locally and in CI. Use `make snapshots` to regenerate, `make snapshots-verify`
# to assert committed snapshots match the current renderer.

DOCKER_IMAGE ?= doc-studio-dev
CAPTURE_IMAGE ?= doc-studio-capture
DOCKERFILE_DEV ?= docker/Dockerfile.dev
DOCKERFILE_CAPTURE ?= docker/Dockerfile.capture
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
        validate snapshots snapshots-verify ci ci-fast clean

help:
	@echo "Doc Studio"
	@echo ""
	@echo "  make docker-build        Build the dev/CI image ($(DOCKER_IMAGE))"
	@echo "  make install             npm ci (in Docker)"
	@echo "  make build               Production build (in Docker)"
	@echo "  make test                Unit tests (in Docker)"
	@echo "  make lint                ESLint (in Docker)"
	@echo "  make format-check        Prettier check (in Docker)"
	@echo "  make validate            Validate example JSON files"
	@echo "  make snapshots           Regenerate tests/snapshots/ (PNG + WebM)"
	@echo "  make snapshots-verify    Recapture PNGs and fail if commit is stale"
	@echo "  make ci                  Full CI pipeline (format, lint, build, test, snapshots-verify)"
	@echo ""
	@echo "  make docker-build-capture   Build remote capture CLI ($(CAPTURE_IMAGE))"

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

lint: docker-build
	$(DOCKER_RUN) npm ci
	$(DOCKER_RUN) npm run lint

format-check: docker-build
	$(DOCKER_RUN) npm ci
	$(DOCKER_RUN) npm run format:check

validate: docker-build
	$(DOCKER_RUN) npm ci
	$(DOCKER_RUN) npm run validate -- examples/poll-moderator-flow.json examples/say-hello-flow.json examples/gimme-otter.json

snapshots: docker-build
	$(DOCKER_RUN) npm ci
	$(DOCKER_RUN) npm run build
	$(DOCKER_RUN) npm run snapshots

snapshots-verify: docker-build
	$(DOCKER_RUN) npm ci
	$(DOCKER_RUN) npm run build
	$(DOCKER_RUN) npm run snapshots:verify

ci: docker-build
	$(DOCKER_RUN) sh -euc '\
		npm ci && \
		npm run format:check && \
		npm run lint && \
		npm run validate -- examples/poll-moderator-flow.json examples/say-hello-flow.json examples/gimme-otter.json && \
		npm run build && \
		npm test && \
		npm run snapshots:verify \
	'

# Assumes doc-studio-dev image is already built (GitHub Actions cache step).
ci-fast:
	$(DOCKER_RUN) sh -euc '\
		npm ci && \
		npm run format:check && \
		npm run lint && \
		npm run validate -- examples/poll-moderator-flow.json examples/say-hello-flow.json examples/gimme-otter.json && \
		npm run build && \
		npm test && \
		npm run snapshots:verify \
	'

clean:
	rm -rf dist node_modules coverage output
