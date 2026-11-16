FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm ci
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM node:20-alpine

WORKDIR /app

COPY package.json LICENSE ./
COPY clarity-guardian.config.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY data ./data
COPY templates ./templates
COPY docs ./docs

ENTRYPOINT ["node"]
CMD ["dist/analyze.js"]
