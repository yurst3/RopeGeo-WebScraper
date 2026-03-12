# One-off migration task: stream S3 full.avif to temp file, run AVIF pipeline, upload four variants, upsert DB.
# Node + Sharp only; no extra system packages required for AVIF.
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
CMD ["npx", "ts-node", "--project", "tsconfig.json", "--files", "src/fargate-tasks/migrateImageData/main.ts"]
