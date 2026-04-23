# Stage 1 (build)
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# Stage 2 (production)
FROM node:24-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache curl

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

RUN chown -R node:node /app
USER node

EXPOSE 4000

CMD ["node", "dist/main.js"]
