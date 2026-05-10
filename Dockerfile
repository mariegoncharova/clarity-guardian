FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY tsconfig.json ./
COPY src ./src
COPY templates ./templates
COPY docs ./docs

RUN npm install
RUN npm run build

ENTRYPOINT ["node"]
CMD ["dist/analyze.js"]
