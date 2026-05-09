FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY templates ./templates
COPY docs ./docs

# Зависимостей сейчас нет.
# Команда оставлена простой, чтобы контейнер можно было использовать
# и для analyze, и для generate-test-checklist.
ENTRYPOINT ["node"]
CMD ["src/analyze.js"]
