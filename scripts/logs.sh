#!/bin/bash

# Script para ver logs del sistema
# Autor: Kalmann Trading Bot

set -e

YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}📋 Logs del Trading Bot (Ctrl+C para salir)${NC}"
echo ""

if [ "$1" == "all" ]; then
    docker-compose logs -f
elif [ "$1" == "prometheus" ]; then
    docker-compose logs -f prometheus
elif [ "$1" == "grafana" ]; then
    docker-compose logs -f grafana
else
    docker-compose logs -f trading-bot
fi
