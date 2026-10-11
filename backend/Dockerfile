FROM node:20-bookworm-slim

# better-sqlite3 necesita compilar un módulo nativo
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
COPY public ./public

# Vendorizar Chart.js localmente (sin depender de un CDN externo en tiempo de ejecución)
RUN mkdir -p ./public/vendor && cp ./node_modules/chart.js/dist/chart.umd.js ./public/vendor/chart.umd.js

ENV PORT=3000
ENV DATA_DIR=/app/data
VOLUME ["/app/data"]

EXPOSE 3000

CMD ["node", "src/server.js"]
