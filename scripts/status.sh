#!/bin/bash

# Script para ver el estado de los servicios
# Autor: Kalmann Trading Bot

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Estado de Servicios                 ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

docker-compose ps

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}💡 Comandos útiles:${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "  Ver logs del bot:       ${GREEN}docker-compose logs -f trading-bot${NC}"
echo -e "  Ver todos los logs:     ${GREEN}docker-compose logs -f${NC}"
echo -e "  Reiniciar bot:          ${GREEN}docker-compose restart trading-bot${NC}"
echo -e "  Detener todo:           ${GREEN}docker-compose stop${NC}"
echo -e "  Ver métricas:           ${GREEN}curl http://localhost:9090/metrics${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""
