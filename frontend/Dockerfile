#STAE 1 : BUILD
FROM node:20-alpine AS builder

LABEL maintainer="DevOps Team Smartscreenhouse"

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV VITE_API_URL=http://APP_API_URL
ENV VITE_MONITORING_URL=http://APP_API_URL
ENV VITE_VAPID_PUBLIC_KEY=API_VAPID_KEY

RUN npm run build

#STAGE 2 : RUNTIME

FROM nginx:alpine 

LABEL maintainer="DevOps Team Smartscreenhouse"

WORKDIR /usr/share/nginx/html

RUN rm -rf ./*

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist .

EXPOSE 80

CMD ["/bin/sh", "-c", "\
sed -i \"s|http://APP_API_URL|$VITE_API_URL|g\" ./assets/*.js && \
sed -i \"s|http://APP_API_URL|$VITE_MONITORING_URL|g\" ./assets/*.js && \
sed -i \"s|API_VAPID_KEY|$VITE_VAPID_PUBLIC_KEY|g\" ./assets/*.js && \
nginx -g 'daemon off;'"]