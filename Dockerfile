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

# Generate the Prisma client at BUILD time so the musl query engine is baked into
# the image. Doing this at runtime (in docker-start) made container startup hang
# long enough for Render to SIGTERM the deploy before the server bound its port.
RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 3000

# docker-start applies pending migrations (`prisma migrate deploy`, needs
# DATABASE_URL at runtime) then serves the built app. The Prisma client is already
# generated above at build time, so startup binds the port quickly.
CMD ["npm", "run", "docker-start"]
