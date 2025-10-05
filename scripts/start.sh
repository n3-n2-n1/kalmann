#!/bin/bash

# Script para iniciar el sistema de trading con Docker Compose
# Autor: Kalmann Trading Bot
# Descripción: Inicia todos los servicios (bot, Prometheus, Grafana)

set -e

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Kalmann Trading Bot - Iniciando     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Verificar que existe .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Archivo .env no encontrado${NC}"
    echo -e "${YELLOW}📝 Creando desde .env.example...${NC}"
    cp .env.example .env
    echo -e "${RED}❌ Por favor, edita el archivo .env con tus credenciales antes de continuar${NC}"
    echo -e "${YELLOW}   Edita: nano .env o vim .env${NC}"
    exit 1
fi

# Verificar que Docker está corriendo
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker no está corriendo. Por favor, inicia Docker primero.${NC}"
    exit 1
fi

# Verificar que docker-compose está instalado
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose no está instalado.${NC}"
    echo -e "${YELLOW}   Instala con: sudo apt install docker-compose${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Verificaciones completadas${NC}"
echo ""

# Build de las imágenes
echo -e "${YELLOW}🔨 Construyendo imágenes Docker...${NC}"
docker-compose build

echo ""
echo -e "${YELLOW}🚀 Iniciando servicios...${NC}"
docker-compose up -d

echo ""
echo -e "${GREEN}✅ Servicios iniciados correctamente${NC}"
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎯 URLs de acceso:${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "  📊 ${YELLOW}Grafana Dashboard:${NC}  http://localhost:3000"
echo -e "     Usuario: admin | Contraseña: (ver .env)"
echo ""
echo -e "  📈 ${YELLOW}Prometheus:${NC}         http://localhost:9091"
echo -e "  🤖 ${YELLOW}Trading Bot MCP:${NC}    http://localhost:3001"
echo -e "  📉 ${YELLOW}Métricas Bot:${NC}       http://localhost:9090/metrics"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📝 Ver logs:${NC}           docker-compose logs -f"
echo -e "${YELLOW}📝 Ver logs del bot:${NC}   docker-compose logs -f trading-bot"
echo -e "${YELLOW}🛑 Detener:${NC}            docker-compose stop"
echo -e "${YELLOW}🗑️  Eliminar todo:${NC}      docker-compose down -v"
echo ""
echo -e "${GREEN}✨ Sistema listo! Monitorea el dashboard en Grafana${NC}"
echo ""

# Mostrar logs del bot
echo -e "${YELLOW}📋 Mostrando logs del bot (Ctrl+C para salir)...${NC}"
echo ""
sleep 2
docker-compose logs -f trading-bot
