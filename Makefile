# MapDataProcessor build: runs on the host (local) or inside SAM's build container (CI/production).
# Local: tippecanoe is often already in PATH (e.g. brew install tippecanoe); it gets copied into the artifact.
# CI/Production: sam build --use-container uses public.ecr.aws/sam/build-nodejs22.x (Amazon Linux 2023).
# That image does not include tippecanoe, so we install it from source (dnf + build). If install or copy
# fails, the build fails so we never deploy a Lambda without the binary.
#
# IMPORTANT: This Lambda is arm64. The tippecanoe binary must be compiled for Linux arm64. When using
# --use-container, the build image for MapDataProcessor MUST be the arm64 variant (e.g. ...:latest-arm64),
# otherwise you get "Exec format error" in production. The pipeline and package.json script use the
# arm64 build image for MapDataProcessor.
build-MapDataProcessor:
	# Install tippecanoe CLI (required for GeoJSON -> vector tiles in Lambda)
	@echo "Installing tippecanoe..."
	@if ! command -v tippecanoe > /dev/null 2>&1; then \
		echo "tippecanoe not found, installing..."; \
		if command -v apt-get > /dev/null 2>&1; then \
			apt-get update && (apt-get install -y tippecanoe || (apt-get install -y libsqlite3-dev build-essential git && git clone https://github.com/felt/tippecanoe.git /tmp/tippecanoe && cd /tmp/tippecanoe && make -j && make install)); \
		elif command -v dnf > /dev/null 2>&1; then \
			echo "Installing tippecanoe from source (dnf)..."; \
			dnf install -y sqlite-devel gcc-c++ make git && git clone https://github.com/felt/tippecanoe.git /tmp/tippecanoe && cd /tmp/tippecanoe && make -j && make install; \
		elif command -v yum > /dev/null 2>&1; then \
			echo "Installing tippecanoe from source (yum)..."; \
			yum install -y sqlite-devel gcc-c++ make git && git clone https://github.com/felt/tippecanoe.git /tmp/tippecanoe && cd /tmp/tippecanoe && make -j && make install; \
		elif command -v brew > /dev/null 2>&1; then \
			brew install tippecanoe; \
		else \
			echo "Installing tippecanoe from source..."; \
			git clone https://github.com/felt/tippecanoe.git /tmp/tippecanoe || true; \
			cd /tmp/tippecanoe && make -j && make install; \
		fi \
	fi

	# Ensure node_modules (including esbuild) is built for container arch (arm64 when building in SAM container)
	@echo "Installing npm dependencies for container architecture..."
	@npm ci

	# Build TypeScript code with esbuild
	@echo "Building TypeScript code with esbuild..."
	@mkdir -p $(ARTIFACTS_DIR)/src/map-data/lambda-handlers
	@npx esbuild src/map-data/lambda-handlers/mainHandler.ts \
		--bundle \
		--platform=node \
		--target=esnext \
		--outfile=$(ARTIFACTS_DIR)/src/map-data/lambda-handlers/mainHandler.js \
		--minify \
		--sourcemap \
		--external:@sparticuz/chromium

	# Copy tippecanoe binary into artifact (required at runtime in Lambda; path is LAMBDA_TASK_ROOT/tippecanoe)
	@TIPPECANOE=$$(command -v tippecanoe 2>/dev/null || echo ""); \
	if [ -z "$$TIPPECANOE" ] && [ -x /usr/local/bin/tippecanoe ]; then TIPPECANOE=/usr/local/bin/tippecanoe; fi; \
	if [ -n "$$TIPPECANOE" ]; then \
		cp "$$TIPPECANOE" $(ARTIFACTS_DIR)/tippecanoe && chmod +x $(ARTIFACTS_DIR)/tippecanoe && echo "tippecanoe binary copied successfully"; \
	else \
		echo "ERROR: tippecanoe not found. MapDataProcessor needs it for vector tile conversion. Install it (e.g. brew install tippecanoe) or ensure the build environment installs it from source."; \
		exit 1; \
	fi
