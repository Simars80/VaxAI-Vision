# Stage 1: build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --frozen-lockfile
COPY . .
# Allow overriding the API base URL at build time.
# Default (/api/v1) relies on the nginx proxy in Stage 2.
# Override example: docker build --build-arg VITE_API_URL=https://api.vaxaivision.com/api/v1 .
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2: serve via nginx
FROM nginx:1.27-alpine AS runner
# Install gettext for envsubst (processes VAXAI_BACKEND_URL in nginx template)
RUN apk add --no-cache gettext
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
# Default backend URL — override at container runtime via -e VAXAI_BACKEND_URL=...
ENV VAXAI_BACKEND_URL=http://vaxai-backend:8000
EXPOSE 80
# envsubst renders the template into the real nginx config before nginx starts
CMD ["/bin/sh", "-c", "envsubst '${VAXAI_BACKEND_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
