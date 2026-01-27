build-MapDataProcessor:
	# Install tippecanoe CLI
	@echo "Installing tippecanoe..."
	@if ! command -v tippecanoe > /dev/null 2>&1; then \
		echo "tippecanoe not found, installing..."; \
		if command -v apt-get > /dev/null 2>&1; then \
			apt-get update && apt-get install -y tippecanoe || (apt-get install -y libsqlite3-dev build-essential git && git clone https://github.com/felt/tippecanoe.git /tmp/tippecanoe && cd /tmp/tippecanoe && make -j && make install); \
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
	
	# Copy tippecanoe binary to artifacts directory
	@echo "Copying tippecanoe binary..."
	@if command -v tippecanoe > /dev/null 2>&1; then \
		cp $$(which tippecanoe) $(ARTIFACTS_DIR)/tippecanoe && \
		chmod +x $(ARTIFACTS_DIR)/tippecanoe; \
		echo "tippecanoe binary copied successfully"; \
	else \
		echo "Warning: tippecanoe binary not found in PATH"; \
	fi
