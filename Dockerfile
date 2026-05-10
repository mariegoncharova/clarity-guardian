FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
COPY tsconfig.json ./
COPY src ./src
RUN npm install
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY --from=build /app/dist ./dist
COPY templates ./templates
COPY docs ./docs

ENTRYPOINT ["node"]
CMD ["dist/analyze.js"]
