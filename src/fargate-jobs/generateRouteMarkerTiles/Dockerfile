# Build and run the route pmtiles job (Tippecanoe). Requires tippecanoe 2.17+ for .pmtiles output.
FROM node:22-alpine

RUN apk add --no-cache tippecanoe

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .
CMD ["npx", "ts-node", "--files", "src/fargate-jobs/generateRouteMarkerTiles/main.ts"]
