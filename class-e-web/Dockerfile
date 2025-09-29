FROM node:18-alpine AS builder

WORKDIR .
COPY package.json package-lock.json tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src

RUN npm ci
RUN npm run build

FROM nginx:stable-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
