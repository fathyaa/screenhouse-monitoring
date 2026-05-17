#STAGE 1 : BUILD
FROM node:20-alpine AS builder

LABEL maintainer="DevOps Team Smartscreenhouse"

WORKDIR /app

COPY package*.json ./

#Install All Dependencies
RUN npm ci --omit=dev

#STAGE 2 : RUNTIME
FROM node:20-alpine

LABEL maintainer="DevOps Team Smartscreenhouse"

RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production

COPY --chown=node:node --from=builder /app/node_modules ./node_modules

COPY --chown=node:node . .

USER node

EXPOSE 3004

CMD ["dumb-init","node", "src/index.js"]