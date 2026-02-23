# Build and run the route pmtiles job (Tippecanoe). Requires tippecanoe 2.17+ for .pmtiles output.
# tippecanoe is not in Alpine repos; build from source (same approach as Makefile build-MapDataProcessor).
FROM node:22-alpine

RUN apk add --no-cache \
    bash \
    git g++ make \
    libgcc libstdc++ \
    sqlite-libs sqlite-dev \
    zlib zlib-dev \
  && git clone https://github.com/felt/tippecanoe.git /tmp/tippecanoe \
  && cd /tmp/tippecanoe && make -j$(nproc) && make install \
  && cd / && rm -rf /tmp/tippecanoe \
  && apk del git g++ make sqlite-dev zlib-dev

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .
CMD ["npx", "ts-node", "--files", "src/fargate-jobs/generateRouteMarkerTiles/main.ts"]
