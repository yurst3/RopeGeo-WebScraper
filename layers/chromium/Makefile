# Build Chromium layer for AWS Lambda per https://github.com/Sparticuz/chromium
# Uses the pre-built arm64 layer from Sparticuz releases (avoids build-from-source
# failures on macOS: TypeScript/CommonJS and BSD sed vs GNU sed).
# Match this version to @sparticuz/chromium in package.json (e.g. ^137.0.0 → 137.0.1).
CHROMIUM_VERSION := 137.0.1
ARCH_TYPE := arm64
LAYER_ZIP := chromium-v$(CHROMIUM_VERSION)-layer.$(ARCH_TYPE).zip
DOWNLOAD_URL := https://github.com/Sparticuz/chromium/releases/download/v$(CHROMIUM_VERSION)/$(LAYER_ZIP)
BUILD_DIR := .build

build-ChromiumLayer:
	@echo "Downloading Chromium layer (arm64, nodejs22.x) v$(CHROMIUM_VERSION)..."
	@mkdir -p $(BUILD_DIR)
	@curl -sSLf -o $(BUILD_DIR)/$(LAYER_ZIP) "$(DOWNLOAD_URL)"
	@mkdir -p $(ARTIFACTS_DIR)
	@echo "Extracting layer into $(ARTIFACTS_DIR)..."
	@unzip -o -q $(BUILD_DIR)/$(LAYER_ZIP) -d $(ARTIFACTS_DIR)
	@echo "Chromium layer build complete."
