#STAE 1 : BUILD
FROM node:20-alpine AS builder

LABEL maintainer="DevOps Team Smartscreenhouse"

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

#STAGE 2 : RUNTIME

FROM nginx:alpine 

LABEL maintainer="DevOps Team Smartscreenhouse"

WORKDIR /usr/share/nginx/html

RUN rm -rf ./*

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist .

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]