# Stage 1: Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install Bun globally inside the container
RUN npm install -g bun@1.3.5

# Copy package descriptors and lockfile for caching dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the rest of the application files
COPY . .

# Generate Prisma client types and compile NestJS to JS
RUN bunx prisma generate
RUN bun run build

# Stage 2: Production runtime stage
FROM node:20-alpine AS runner
WORKDIR /app

# Install Bun globally
RUN npm install -g bun@1.3.5

# Copy packages and lockfile to fetch only production packages
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

# Copy compiled build output and database schema
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Expose NestJS default port
EXPOSE 3000

# Run the NestJS application
CMD ["bun", "run", "start:prod"]
