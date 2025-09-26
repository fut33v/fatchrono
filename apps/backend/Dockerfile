# syntax=docker/dockerfile:1.7

FROM node:20-bookworm AS builder
WORKDIR /app

COPY apps/backend/package.json ./package.json
RUN npm install

COPY apps/backend/ ./
RUN npm run build

FROM node:20-bookworm
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3001
CMD ["node", "dist/main.js"]
