# Stage 1: Build stage
FROM node:24-alpine AS builder
WORKDIR /app

# Install Bun globally inside the container
RUN npm install -g bun@1.3.5

# Copy package descriptors and lockfile for caching dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the rest of the application files
COPY . .

# Generate Prisma client types and compile NestJS to JS
RUN bun run build

# Migration tooling uses the same locked CLI as the build, separately from runtime.
FROM builder AS migrations
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

# Stage 2: Production runtime stage
FROM node:24-alpine AS runner
WORKDIR /app

# Install Bun globally
RUN npm install -g bun@1.3.5

# Copy packages and lockfile to fetch only production packages
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

# Copy compiled build output and database schema
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

ENV NODE_ENV=production
ENV PORT=3000
USER node

# Expose NestJS default port
EXPOSE 3000

# Run the NestJS application
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/health/ready',{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/src/main.js"]
