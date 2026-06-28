FROM node:20-alpine

WORKDIR /app

# Install ALL deps — the production build needs devDependencies (vite, @remix-run/dev).
COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

# Copy source and build the Remix app.
COPY . .
RUN npm run build

# The Shopify CLI is only needed at dev time; drop it from the runtime image.
RUN npm remove @shopify/cli || true

ENV NODE_ENV=production
EXPOSE 3000

# docker-start runs `prisma generate && prisma migrate deploy` (when DATABASE_URL
# is present at runtime) then serves the built app.
CMD ["npm", "run", "docker-start"]
