# --- build stage ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# URL API di-bake saat build (Vite). Default same-origin: REST lewat /api,
# Socket.IO lewat /socket.io — keduanya diproksi nginx ke service backend.
ARG VITE_DEV_PROXY=false
ARG VITE_API_URL=/api
ARG VITE_MONITORING_URL=
ARG VITE_VAPID_PUBLIC_KEY=BNJNuE0rZ1Y11APM6NjqiA_GXXJ9kwgaorVLx5mi8iFdNWEuEUZEQ6VE4TdZAgmivXm82ZrlkjKgcMrpcryedHo
ENV VITE_DEV_PROXY=$VITE_DEV_PROXY \
    VITE_API_URL=$VITE_API_URL \
    VITE_MONITORING_URL=$VITE_MONITORING_URL \
    VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY

RUN npm run build

# --- serve stage ---
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
