FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
CMD ["npx", "ts-node", "--project", "tsconfig.json", "--files", "src/fargate-tasks/backfillAttribution/main.ts"]
