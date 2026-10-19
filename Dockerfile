FROM node:24.22.0-alpine AS base

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --offline --omit=dev --ignore-scripts --no-audit --no-fund

COPY server.mjs ./
COPY src ./src
COPY public ./public

FROM base AS test

COPY .nvmrc .env.example .gitignore .dockerignore .gitattributes Dockerfile README.md ./
COPY test ./test
RUN --network=none npm test

CMD ["npm", "test"]

FROM base AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.mjs"]
