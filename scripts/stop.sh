#!/bin/bash

# Script para detener el sistema de trading
# Autor: Kalmann Trading Bot

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🛑 Deteniendo servicios de trading...${NC}"
echo ""

docker-compose stop

echo ""
echo -e "${GREEN}✅ Servicios detenidos correctamente${NC}"
echo -e "${YELLOW}💡 Para reiniciar: ./scripts/start.sh${NC}"
echo -e "${YELLOW}💡 Para eliminar todo: docker-compose down -v${NC}"
echo ""
