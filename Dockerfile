# Dockerfile multi-stage para optimizar tamaño y build
FROM node:20-alpine AS builder

# Instalar pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml ./

# Instalar dependencias
RUN pnpm install --frozen-lockfile

# Copiar código fuente
COPY . .

# Build del proyecto TypeScript
RUN pnpm run build

# Stage de producción
FROM node:20-alpine

# Instalar pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copiar solo lo necesario desde builder
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Crear directorio de logs
RUN mkdir -p /app/logs

# Variables de entorno por defecto
ENV NODE_ENV=production \
    LOG_LEVEL=info \
    MCP_PORT=3001

# Exponer puerto MCP
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando para iniciar el bot
CMD ["node", "dist/index.js"]
