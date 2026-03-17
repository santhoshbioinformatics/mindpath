# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

# Run migrations then start
EXPOSE 3000
CMD ["dumb-init", "node", "dist/main"]
