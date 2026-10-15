FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/admin-dist ./admin-dist
COPY --from=build /app/web-dist ./web-dist
COPY server.js donations.sql ./
COPY migrations ./migrations
COPY scripts ./scripts
COPY index.html classifier.html styles.css tool.css nav.js script.js registration.js donation.js company-donation.js gallery.js ./
RUN mkdir -p uploads
EXPOSE 8001
CMD ["sh", "-c", "node scripts/migrate.js && node server.js"]
