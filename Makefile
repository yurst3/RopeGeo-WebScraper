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
	
	# Build TypeScript code with esbuild (externalize pg, zapatos, and geo/xml deps; copy them into artifacts)
	@echo "Building TypeScript code with esbuild..."
	@mkdir -p $(ARTIFACTS_DIR)/src/map-data/lambda-handlers
	@npx esbuild src/map-data/lambda-handlers/mainHandler.ts \
		--bundle \
		--platform=node \
		--target=node22 \
		--format=cjs \
		--outfile=$(ARTIFACTS_DIR)/src/map-data/lambda-handlers/mainHandler.js \
		--minify \
		--sourcemap \
		--external:pg \
		--external:zapatos/db \
		--external:zapatos/schema \
		--external:@tmcw/togeojson \
		--external:@xmldom/xmldom \
		--external:@sparticuz/chromium
	# Copy node_modules for externalized packages into artifacts (Lambda resolves them at runtime)
	@echo "Copying node_modules for external dependencies..."
	@mkdir -p $(ARTIFACTS_DIR)/node_modules $(ARTIFACTS_DIR)/node_modules/@tmcw $(ARTIFACTS_DIR)/node_modules/@xmldom
	@for pkg in pg pg-connection-string pg-pool pg-protocol pg-types pgpass pg-int8 postgres-array postgres-bytea postgres-date postgres-interval xtend json-custom-numbers; do \
		[ -d node_modules/$$pkg ] && cp -r node_modules/$$pkg $(ARTIFACTS_DIR)/node_modules/; \
	done
	@cp -r node_modules/zapatos $(ARTIFACTS_DIR)/node_modules/
	@cp -r node_modules/@tmcw/togeojson $(ARTIFACTS_DIR)/node_modules/@tmcw/
	@cp -r node_modules/@xmldom/xmldom $(ARTIFACTS_DIR)/node_modules/@xmldom/
	
	# Copy tippecanoe binary to artifacts directory
	@echo "Copying tippecanoe binary..."
	@if command -v tippecanoe > /dev/null 2>&1; then \
		cp $$(which tippecanoe) $(ARTIFACTS_DIR)/tippecanoe && \
		chmod +x $(ARTIFACTS_DIR)/tippecanoe; \
		echo "tippecanoe binary copied successfully"; \
	else \
		echo "Warning: tippecanoe binary not found in PATH"; \
	fi
