# Sistema de Trading Automatizado con IA

Sistema avanzado de trading automatizado que utiliza MCP (Model Context Protocol), Ollama2, y análisis predictivo con filtro de Kalman para operar en perpetuos de Bybit.

## 🚀 Características Principales

- **Integración MCP**: Protocolo de comunicación con modelos de IA
- **Análisis Predictivo**: Filtro de Kalman para predicción de precios
- **IA Avanzada**: Decisiones de trading basadas en Ollama2
- **Gestión de Riesgo**: Sistema inteligente de protección de capital
- **Trading Automatizado**: Operaciones automáticas en perpetuos
- **Análisis Técnico**: Indicadores avanzados (RSI, MACD, Bollinger, EMA)
- **Monitoreo en Tiempo Real**: Logging y métricas detalladas

## 🏗️ Arquitectura

```
src/
├── ai/                    # Cliente Ollama y análisis de IA
├── analysis/             # Análisis técnico y filtro de Kalman
├── exchange/             # Cliente Bybit para trading
├── mcp/                  # Servidor MCP
├── risk/                 # Gestión de riesgo
├── strategy/             # Estrategias de trading
├── types/                # Definiciones de tipos
└── utils/                # Utilidades y logging
```

## 🛠️ Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd ai-trading-system
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
# Editar .env con tus credenciales
```

4. **Instalar y configurar Ollama**
```bash
# Instalar Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Descargar modelo
ollama pull llama2:7b-chat
```

## ⚙️ Configuración

### Variables de Entorno

```env
# Bybit API
BYBIT_API_KEY=your_api_key
BYBIT_API_SECRET=your_api_secret
BYBIT_TESTNET=true

# Ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama2:7b-chat

# Trading
ENABLE_AUTO_TRADING=false
TRADING_SYMBOL=BTCUSDT
TRADING_INTERVAL=5m

# Riesgo
MAX_LEVERAGE=5
RISK_PERCENTAGE=2
PAPER_TRADING=true
```

### Configuración de Bybit

1. Crear cuenta en Bybit
2. Generar API Key y Secret
3. Configurar permisos: Trading, Reading
4. Usar testnet para pruebas

## 🚀 Uso

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm run build
npm start
```

### Comandos Disponibles
```bash
npm run build      # Compilar TypeScript
npm start          # Ejecutar en producción
npm run dev        # Ejecutar en desarrollo
npm test           # Ejecutar tests
npm run lint       # Linter
npm run format     # Formatear código
```

## 🔧 API MCP

El sistema expone las siguientes herramientas MCP:

### `get_market_data`
Obtiene datos de mercado en tiempo real
```json
{
  "symbol": "BTCUSDT",
  "interval": "5m"
}
```

### `analyze_technical`
Análisis técnico completo
```json
{
  "symbol": "BTCUSDT",
  "period": 14
}
```

### `kalman_predict`
Predicción usando filtro de Kalman
```json
{
  "symbol": "BTCUSDT",
  "lookAhead": 5
}
```

### `ai_analysis`
Análisis completo de IA
```json
{
  "symbol": "BTCUSDT",
  "context": "Análisis de mercado"
}
```

### `execute_trade`
Ejecuta orden de trading
```json
{
  "symbol": "BTCUSDT",
  "side": "Buy",
  "quantity": 0.001,
  "leverage": 2
}
```

## 📊 Estrategia de Trading

### Flujo de Decisión

1. **Recolección de Datos**: Precios, volumen, indicadores
2. **Análisis Técnico**: RSI, MACD, Bollinger, EMA
3. **Predicción Kalman**: Precio futuro y tendencia
4. **Análisis IA**: Decisión basada en todos los factores
5. **Gestión de Riesgo**: Validación antes de ejecutar
6. **Ejecución**: Trade automático si es aprobado

### Indicadores Utilizados

- **RSI**: Momentum y sobrecompra/sobreventa
- **MACD**: Convergencia/divergencia de medias
- **Bollinger Bands**: Volatilidad y niveles
- **EMA**: Tendencia a corto, medio y largo plazo
- **Volumen**: Confirmación de movimientos
- **Kalman Filter**: Predicción de precios

### Gestión de Riesgo

- **Límite de Leverage**: Máximo configurable
- **Stop Loss**: Protección automática
- **Take Profit**: Objetivos de ganancia
- **Exposición**: Control de posición máxima
- **Trades Diarios**: Límite de operaciones

## 🔍 Monitoreo

### Logs
- **Nivel**: info, debug, warn, error
- **Archivos**: `logs/combined.log`, `logs/error.log`
- **Rotación**: Automática por tamaño

### Métricas
- Trades ejecutados
- PnL por posición
- Confianza de IA
- Precisión de predicciones

## 🛡️ Seguridad

- **API Keys**: Variables de entorno
- **Testnet**: Modo seguro para pruebas
- **Validación**: Múltiples capas de verificación
- **Logging**: Auditoría completa

## 📈 Optimización

### Parámetros Ajustables

- **Filtro Kalman**: Q (ruido proceso), R (ruido medición)
- **Indicadores**: Períodos y sensibilidades
- **IA**: Temperatura y parámetros de modelo
- **Riesgo**: Porcentajes y límites

### Backtesting
```typescript
// Ejemplo de backtesting
const results = await strategy.backtest({
  symbol: 'BTCUSDT',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  initialBalance: 1000
});
```

## 🚨 Advertencias

⚠️ **IMPORTANTE**: Este sistema es para fines educativos y de investigación.

- **Riesgo**: Trading conlleva riesgo de pérdida
- **Testing**: Siempre usar testnet primero
- **Capital**: No arriesgar más de lo que puedes perder
- **Monitoreo**: Supervisar constantemente

## 🤝 Contribución

1. Fork el proyecto
2. Crear feature branch
3. Commit cambios
4. Push a branch
5. Crear Pull Request

## 📄 Licencia

MIT License - ver archivo LICENSE

## 🆘 Soporte

- **Issues**: GitHub Issues
- **Documentación**: README y comentarios
- **Logs**: Revisar logs para debugging

---

**Desarrollado con ❤️ para la comunidad de trading algorítmico**
