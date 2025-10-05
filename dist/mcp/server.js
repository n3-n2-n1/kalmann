"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPServer = void 0;
const http_1 = require("http");
const ws_1 = require("ws");
const logger_1 = require("../utils/logger");
const ollama_client_1 = require("../ai/ollama-client");
const bybit_client_1 = require("../exchange/bybit-client");
const kalman_filter_1 = require("../analysis/kalman-filter");
const technical_analysis_1 = require("../analysis/technical-analysis");
const risk_manager_1 = require("../risk/risk-manager");
/**
 * Servidor MCP principal que orquesta todo el sistema de trading
 */
class MCPServer {
    server;
    wss;
    logger;
    ollama;
    bybit;
    kalman;
    technical;
    riskManager;
    tools;
    activeConnections;
    constructor(port = 3001) {
        this.logger = new logger_1.Logger('MCPServer');
        this.tools = new Map();
        this.activeConnections = new Set();
        // Inicializar componentes
        this.ollama = new ollama_client_1.OllamaClient();
        this.bybit = new bybit_client_1.BybitClient();
        this.kalman = new kalman_filter_1.KalmanFilter();
        this.technical = new technical_analysis_1.TechnicalAnalysis();
        this.riskManager = new risk_manager_1.RiskManager();
        // Crear servidor HTTP y WebSocket
        this.server = (0, http_1.createServer)();
        this.wss = new ws_1.WebSocketServer({ server: this.server });
        this.setupWebSocketHandlers();
        this.registerTools();
        this.server.listen(port, () => {
            this.logger.info(`Servidor MCP iniciado en puerto ${port}`);
        });
    }
    /**
     * Configura los manejadores de WebSocket para comunicación MCP
     */
    setupWebSocketHandlers() {
        this.wss.on('connection', (ws) => {
            this.logger.info('Nueva conexión MCP establecida');
            this.activeConnections.add(ws);
            ws.on('message', async (data) => {
                try {
                    const request = JSON.parse(data.toString());
                    const response = await this.handleMCPRequest(request);
                    ws.send(JSON.stringify(response));
                }
                catch (error) {
                    this.logger.error('Error procesando mensaje MCP:', error);
                    const errorResponse = {
                        id: 'unknown',
                        error: {
                            code: -1,
                            message: error instanceof Error ? error.message : 'Error desconocido'
                        },
                        timestamp: Date.now()
                    };
                    ws.send(JSON.stringify(errorResponse));
                }
            });
            ws.on('close', () => {
                this.logger.info('Conexión MCP cerrada');
                this.activeConnections.delete(ws);
            });
            ws.on('error', (error) => {
                this.logger.error('Error en conexión WebSocket:', error);
                this.activeConnections.delete(ws);
            });
        });
    }
    /**
     * Registra todas las herramientas MCP disponibles
     */
    registerTools() {
        // Herramienta para obtener datos de mercado
        this.registerTool({
            name: 'get_market_data',
            description: 'Obtiene datos de mercado en tiempo real para un símbolo',
            inputSchema: {
                type: 'object',
                properties: {
                    symbol: { type: 'string' },
                    interval: { type: 'string', default: '5m' }
                },
                required: ['symbol']
            },
            handler: async (params) => {
                return await this.bybit.getMarketData(params.symbol, params.interval);
            }
        });
        // Herramienta para análisis técnico
        this.registerTool({
            name: 'analyze_technical',
            description: 'Realiza análisis técnico completo de un símbolo',
            inputSchema: {
                type: 'object',
                properties: {
                    symbol: { type: 'string' },
                    period: { type: 'number', default: 14 }
                },
                required: ['symbol']
            },
            handler: async (params) => {
                const klines = await this.bybit.getKlines(params.symbol, '5m', 100);
                return await this.technical.analyze(klines, params.period);
            }
        });
        // Herramienta para predicción Kalman
        this.registerTool({
            name: 'kalman_predict',
            description: 'Genera predicción de precio usando filtro de Kalman',
            inputSchema: {
                type: 'object',
                properties: {
                    symbol: { type: 'string' },
                    lookAhead: { type: 'number', default: 5 }
                },
                required: ['symbol']
            },
            handler: async (params) => {
                const klines = await this.bybit.getKlines(params.symbol, '5m', 50);
                return await this.kalman.predict(klines, params.lookAhead);
            }
        });
        // Herramienta para análisis de IA
        this.registerTool({
            name: 'ai_analysis',
            description: 'Solicita análisis completo de IA para trading',
            inputSchema: {
                type: 'object',
                properties: {
                    symbol: { type: 'string' },
                    context: { type: 'string' }
                },
                required: ['symbol']
            },
            handler: async (params) => {
                // Obtener datos necesarios
                const marketData = await this.bybit.getMarketData(params.symbol);
                const klines = await this.bybit.getKlines(params.symbol, '5m', 100);
                const technical = await this.technical.analyze(klines);
                const kalman = await this.kalman.predict(klines);
                // Preparar prompt para Ollama
                const prompt = this.buildAIPrompt(marketData, technical, kalman, params.context);
                // Obtener análisis de IA
                return await this.ollama.analyze(prompt);
            }
        });
        // Herramienta para ejecutar trades
        this.registerTool({
            name: 'execute_trade',
            description: 'Ejecuta una orden de trading después de validación de riesgo',
            inputSchema: {
                type: 'object',
                properties: {
                    symbol: { type: 'string' },
                    side: { type: 'string', enum: ['Buy', 'Sell'] },
                    quantity: { type: 'number' },
                    leverage: { type: 'number' },
                    stopLoss: { type: 'number' },
                    takeProfit: { type: 'number' }
                },
                required: ['symbol', 'side', 'quantity']
            },
            handler: async (params) => {
                // Validar riesgo antes de ejecutar
                const riskCheck = await this.riskManager.validateTrade(params);
                if (!riskCheck.approved) {
                    throw new Error(`Trade rechazado: ${riskCheck.reason}`);
                }
                // Ejecutar trade
                return await this.bybit.executeTrade(params);
            }
        });
        // Herramienta para obtener posiciones activas
        this.registerTool({
            name: 'get_positions',
            description: 'Obtiene todas las posiciones activas',
            inputSchema: {
                type: 'object',
                properties: {
                    symbol: { type: 'string' }
                }
            },
            handler: async (params) => {
                return await this.bybit.getPositions(params.symbol);
            }
        });
        // Herramienta para cerrar posiciones (completa o parcialmente)
        this.registerTool({
            name: 'close_position',
            description: 'Cierra una posición existente (completa o parcialmente). Usa esto cuando detectes señales de salida o reversión.',
            inputSchema: {
                type: 'object',
                properties: {
                    symbol: { type: 'string' },
                    side: { type: 'string', enum: ['Buy', 'Sell'], description: 'El lado de la posición a cerrar' },
                    percentage: { type: 'number', default: 100, description: 'Porcentaje a cerrar: 25, 50 o 100' },
                    reason: { type: 'string', description: 'Razón para cerrar la posición' }
                },
                required: ['symbol', 'side']
            },
            handler: async (params) => {
                const percentage = params.percentage || 100;
                this.logger.info(`MCP Tool: Cerrando ${percentage}% de posición ${params.side} ${params.symbol}. Razón: ${params.reason || 'No especificada'}`);
                return await this.bybit.closePosition(params.symbol, params.side, percentage);
            }
        });
        // ========== NUEVAS TOOLS PARA SCALPING Y MULTI-TIMEFRAME ==========
        // Tool 1: Obtener datos de mercado en timeframe 1m (para detectar micro-ciclos)
        this.registerTool({
            name: 'get_market_data_1m',
            description: 'Obtiene datos de mercado en timeframe de 1 minuto para detectar micro-ciclos y oportunidades de scalping. Úsalo para ver movimientos recientes de corto plazo.',
            inputSchema: {
                type: 'object',
                properties: {
                    symbol: { type: 'string' },
                    limit: { type: 'number', default: 20, description: 'Número de velas a obtener (default: 20)' }
                },
                required: ['symbol']
            },
            handler: async (params) => {
                const klines1m = await this.bybit.getKlines(params.symbol, '1m', params.limit || 20);
                const latest = klines1m[klines1m.length - 1];
                return {
                    timeframe: '1m',
                    candles_count: klines1m.length,
                    latest_price: latest.close,
                    latest_volume: latest.volume,
                    price_change_last_5m: ((latest.close - klines1m[Math.max(0, klines1m.length - 6)].close) / klines1m[Math.max(0, klines1m.length - 6)].close * 100).toFixed(3) + '%',
                    klines: klines1m.slice(-10) // Últimas 10 velas
                };
            }
        });
        // Tool 2: Detectar patrones de velas (3 rojas, 3 verdes, doji, etc)
        this.registerTool({
            name: 'analyze_candle_pattern',
            description: 'Detecta patrones de velas en 1 minuto como 3 rojas consecutivas, 3 verdes, volume spikes, doji, etc. Perfecto para identificar reversiones rápidas en scalping.',
            inputSchema: {
                type: 'object',
                properties: {
                    symbol: { type: 'string' },
                    lookback: { type: 'number', default: 20, description: 'Número de velas a analizar (default: 20)' }
                },
                required: ['symbol']
            },
            handler: async (params) => {
                const klines1m = await this.bybit.getKlines(params.symbol, '1m', params.lookback || 20);
                const patterns = this.technical.detectCandlePatterns(klines1m);
                return {
                    symbol: params.symbol,
                    timeframe: '1m',
                    patterns_found: patterns.patterns,
                    last_candles: patterns.lastCandles,
                    summary: patterns.patterns.length > 0
                        ? `${patterns.patterns.length} patrón(es) detectado(s): ${patterns.patterns.map(p => p.type).join(', ')}`
                        : 'No se detectaron patrones significativos'
                };
            }
        });
        // Tool 3: Comparar tendencia 1m vs 5m (detectar divergencias = oportunidades)
        this.registerTool({
            name: 'detect_micro_trend',
            description: 'Compara la tendencia de 1 minuto vs 5 minutos para detectar divergencias. Una divergencia (ej: tendencia alcista en 5m pero bajista en 1m) es una oportunidad perfecta para scalping.',
            inputSchema: {
                type: 'object',
                properties: {
                    symbol: { type: 'string' }
                },
                required: ['symbol']
            },
            handler: async (params) => {
                const klines1m = await this.bybit.getKlines(params.symbol, '1m', 20);
                const klines5m = await this.bybit.getKlines(params.symbol, '5m', 40);
                const analysis = this.technical.compareTrends(klines1m, klines5m);
                return {
                    symbol: params.symbol,
                    micro_trend_1m: analysis.microTrend,
                    macro_trend_5m: analysis.macroTrend,
                    divergence_detected: analysis.divergence,
                    suggested_action: analysis.suggestedAction,
                    confidence: analysis.confidence,
                    interpretation: analysis.divergence
                        ? `🎯 OPORTUNIDAD: Divergencia detectada! Tendencia general ${analysis.macroTrend} pero micro ${analysis.microTrend}. Sugerencia: ${analysis.suggestedAction}`
                        : `Tendencias alineadas: ${analysis.macroTrend}. Sin divergencia.`
                };
            }
        });
        // Tool 4: Analizar Order Book (presión compra/venta, walls, liquidez)
        this.registerTool({
            name: 'analyze_order_book',
            description: 'Analiza el libro de órdenes (order book) para detectar presión de compra/venta, "walls" (grandes órdenes), spread y liquidez. Esto muestra la INTENCIÓN REAL del mercado en tiempo real.',
            inputSchema: {
                type: 'object',
                properties: {
                    symbol: { type: 'string' },
                    depth: { type: 'number', default: 50, description: 'Profundidad del order book (default: 50)' }
                },
                required: ['symbol']
            },
            handler: async (params) => {
                const orderBook = await this.bybit.getOrderBook(params.symbol, params.depth || 50);
                const analysis = this.technical.analyzeOrderBook(orderBook);
                return {
                    symbol: params.symbol,
                    timestamp: orderBook.timestamp,
                    best_bid: orderBook.bids[0]?.price,
                    best_ask: orderBook.asks[0]?.price,
                    spread: analysis.spread.toFixed(2),
                    spread_percent: analysis.spreadPercent.toFixed(4) + '%',
                    bid_ask_imbalance: analysis.bidAskImbalance.toFixed(2),
                    total_bid_liquidity: analysis.totalBidLiquidity.toFixed(4),
                    total_ask_liquidity: analysis.totalAskLiquidity.toFixed(4),
                    market_pressure: analysis.pressure,
                    confidence: analysis.confidence,
                    bid_walls: analysis.bidWalls,
                    ask_walls: analysis.askWalls,
                    interpretation: analysis.pressure === 'BULLISH'
                        ? `📈 Presión ALCISTA (${(analysis.bidAskImbalance * 100).toFixed(0)}% más compradores que vendedores)`
                        : analysis.pressure === 'BEARISH'
                            ? `📉 Presión BAJISTA (${(analysis.bidAskImbalance * 100).toFixed(0)}% más vendedores que compradores)`
                            : '➡️  Presión NEUTRAL - mercado equilibrado'
                };
            }
        });
        this.logger.info(`${this.tools.size} herramientas MCP registradas`);
    }
    /**
     * Registra una nueva herramienta MCP
     */
    registerTool(tool) {
        this.tools.set(tool.name, tool);
        this.logger.debug(`Herramienta registrada: ${tool.name}`);
    }
    /**
     * Maneja una solicitud MCP
     */
    async handleMCPRequest(request) {
        this.logger.debug(`Procesando solicitud MCP: ${request.method}`);
        try {
            switch (request.method) {
                case 'tools/list':
                    return {
                        id: request.id,
                        result: {
                            tools: Array.from(this.tools.values()).map(tool => ({
                                name: tool.name,
                                description: tool.description,
                                inputSchema: tool.inputSchema
                            }))
                        },
                        timestamp: Date.now()
                    };
                case 'tools/call':
                    const { name, arguments: args } = request.params;
                    const tool = this.tools.get(name);
                    if (!tool) {
                        throw new Error(`Herramienta no encontrada: ${name}`);
                    }
                    const result = await tool.handler(args);
                    return {
                        id: request.id,
                        result: {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(result, null, 2)
                                }
                            ]
                        },
                        timestamp: Date.now()
                    };
                default:
                    throw new Error(`Método MCP no soportado: ${request.method}`);
            }
        }
        catch (error) {
            this.logger.error(`Error en solicitud MCP ${request.id}:`, error);
            return {
                id: request.id,
                error: {
                    code: -1,
                    message: error instanceof Error ? error.message : 'Error desconocido'
                },
                timestamp: Date.now()
            };
        }
    }
    /**
     * Construye el prompt para el análisis de IA
     */
    buildAIPrompt(marketData, technical, kalman, context) {
        return `
Eres un trader experto con IA. Analiza la siguiente información de mercado y proporciona una decisión de trading:

DATOS DE MERCADO:
${JSON.stringify(marketData, null, 2)}

INDICADORES TÉCNICOS:
${JSON.stringify(technical, null, 2)}

PREDICCIÓN KALMAN:
${JSON.stringify(kalman, null, 2)}

CONTEXTO ADICIONAL: ${context || 'Ninguno'}

Proporciona tu análisis en el siguiente formato JSON:
{
  "decision": "BUY|SELL|HOLD",
  "confidence": 0.0-1.0,
  "reasoning": "Explicación detallada",
  "suggestedLeverage": 1-10,
  "riskLevel": "low|medium|high",
  "marketSentiment": "bullish|bearish|neutral"
}

Sé preciso, objetivo y considera todos los factores de riesgo.
    `;
    }
    /**
     * Broadcast a todas las conexiones activas
     */
    broadcast(message) {
        const data = JSON.stringify(message);
        this.activeConnections.forEach(ws => {
            if (ws.readyState === ws_1.WebSocket.OPEN) {
                ws.send(data);
            }
        });
    }
    /**
     * Cierra el servidor
     */
    async close() {
        return new Promise((resolve) => {
            this.wss.close(() => {
                this.server.close(() => {
                    this.logger.info('Servidor MCP cerrado');
                    resolve();
                });
            });
        });
    }
}
exports.MCPServer = MCPServer;
//# sourceMappingURL=server.js.map