"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingStrategy = void 0;
const logger_1 = require("../utils/logger");
const ollama_client_1 = require("../ai/ollama-client");
const technical_analysis_1 = require("../analysis/technical-analysis");
const kalman_filter_1 = require("../analysis/kalman-filter");
const risk_manager_1 = require("../risk/risk-manager");
const bybit_client_1 = require("../exchange/bybit-client");
const data_manager_1 = require("../data/data-manager");
/**
 * Estrategia de trading automatizada con IA
 * Combina análisis técnico, predicción Kalman y decisiones de IA
 */
class TradingStrategy {
    logger;
    ollama;
    technical;
    kalman;
    riskManager;
    bybit;
    dataManager;
    isRunning = false;
    // private currentPositions: Map<string, any> = new Map(); // Para futuras implementaciones
    constructor() {
        this.logger = new logger_1.Logger('TradingStrategy');
        this.ollama = new ollama_client_1.OllamaClient();
        this.technical = new technical_analysis_1.TechnicalAnalysis();
        this.kalman = new kalman_filter_1.KalmanFilter();
        this.riskManager = new risk_manager_1.RiskManager();
        this.bybit = new bybit_client_1.BybitClient();
        this.dataManager = new data_manager_1.DataManager();
    }
    /**
     * Inicia la estrategia de trading
     */
    async start(symbol, interval = '5m') {
        try {
            this.logger.system('TradingStrategy', 'start', { symbol, interval });
            this.isRunning = true;
            // Verificar conectividad
            await this.healthCheck();
            // Iniciar recopilación de datos
            await this.dataManager.startDataCollection(symbol, interval);
            // Esperar a que se recopilen suficientes datos
            await this.waitForData(symbol);
            // Iniciar loop de trading
            this.tradingLoop(symbol, interval);
        }
        catch (error) {
            this.logger.error('Error iniciando estrategia:', error);
            throw error;
        }
    }
    /**
     * Detiene la estrategia de trading
     */
    async stop() {
        this.logger.system('TradingStrategy', 'stop');
        this.isRunning = false;
        this.dataManager.stopDataCollection();
    }
    /**
     * Loop principal de trading
     */
    async tradingLoop(symbol, interval) {
        while (this.isRunning) {
            try {
                // Verificar que tenemos suficientes datos
                if (!this.dataManager.hasEnoughData(symbol, 50)) {
                    this.logger.warn(`Esperando más datos para ${symbol}. Actual: ${this.dataManager.getBufferStats(symbol).totalKlines} velas`);
                    await this.sleep(5000);
                    continue;
                }
                // Obtener datos del buffer local
                const klines = this.dataManager.getKlines(symbol, 100);
                // Realizar análisis completo
                const analysis = await this.performCompleteAnalysis(symbol, klines);
                // Generar señal de trading
                const signal = await this.generateTradingSignal(symbol, analysis);
                // Ejecutar acción si es necesaria
                if (signal) {
                    this.logger.info(`EJECUTANDO TRADE: ${signal.action} ${signal.quantity} ${signal.symbol}`);
                    await this.executeTradingAction(signal);
                }
                else {
                    this.logger.info('No se generó señal de trading, esperando siguiente ciclo');
                }
                // Esperar antes del siguiente ciclo
                await this.sleep(this.getIntervalMs(interval));
            }
            catch (error) {
                this.logger.error('Error en loop de trading:', error);
                await this.sleep(30000); // Esperar 30 segundos en caso de error
            }
        }
    }
    /**
     * Realiza análisis completo del mercado
     */
    async performCompleteAnalysis(symbol, klines) {
        // Análisis técnico
        const technical = await this.technical.analyze(klines);
        // Predicción Kalman
        const kalman = await this.kalman.predict(klines);
        // Datos de mercado
        const marketData = await this.bybit.getMarketData(symbol);
        // Análisis de IA
        const aiPrompt = this.buildAIPrompt(marketData, technical, kalman, klines);
        const ai = await this.ollama.analyze(aiPrompt);
        this.logger.aiAnalysis({
            symbol,
            decision: ai.decision,
            confidence: ai.confidence,
            reasoning: ai.reasoning,
            indicators: technical
        });
        return { technical, kalman, ai, marketData };
    }
    /**
     * Genera señal de trading basada en el análisis
     */
    async generateTradingSignal(symbol, analysis) {
        const { technical, kalman, ai, marketData } = analysis;
        // Verificar si ya tenemos una posición abierta
        const existingPosition = await this.bybit.getPositions(symbol);
        this.logger.info(`Posiciones existentes: ${existingPosition.length}`);
        if (existingPosition.length > 0) {
            this.logger.info('Analizando posición existente...');
            return this.analyzeExistingPosition(existingPosition[0], analysis);
        }
        // Generar nueva señal solo si no hay posición
        if (ai.decision === 'HOLD') {
            this.logger.info('AI sugiere HOLD, no se ejecutará trade');
            return null;
        }
        this.logger.info(`AI sugiere ${ai.decision} con confianza ${ai.confidence}`);
        // Calcular parámetros de trading
        const leverage = this.calculateOptimalLeverage(ai, technical, kalman);
        const quantity = await this.calculatePositionSize(symbol, marketData.price, leverage);
        this.logger.info(`Parámetros calculados - Leverage: ${leverage}x, Quantity: ${quantity}`);
        if (quantity <= 0) {
            this.logger.warn('Cantidad calculada es 0 o negativa, saltando trade');
            return null;
        }
        // Calcular stop loss y take profit
        const stopLoss = this.calculateStopLoss(marketData.price, ai.decision, technical);
        const takeProfit = this.calculateTakeProfit(marketData.price, stopLoss, ai.confidence);
        this.logger.info(`Generando señal de trading: ${ai.decision} ${quantity} ${symbol} @ ${marketData.price} (SL: ${stopLoss}, TP: ${takeProfit})`);
        return {
            symbol,
            action: ai.decision,
            leverage,
            quantity,
            stopLoss,
            takeProfit,
            timestamp: Date.now(),
            aiAnalysis: ai
        };
    }
    /**
     * Analiza posición existente y decide si cerrar
     */
    async analyzeExistingPosition(position, analysis) {
        const { ai, technical, kalman } = analysis;
        // Lógica para cerrar posición
        const shouldClose = this.shouldClosePosition(position, ai, technical, kalman);
        if (shouldClose) {
            return {
                symbol: position.symbol,
                action: 'CLOSE',
                leverage: position.leverage,
                quantity: position.size,
                timestamp: Date.now(),
                aiAnalysis: ai
            };
        }
        return null;
    }
    /**
     * Determina si debe cerrar una posición existente
     */
    shouldClosePosition(position, ai, _technical, _kalman) {
        // Cerrar si la IA sugiere lo contrario a la posición actual
        if (position.side === 'Buy' && ai.decision === 'SELL')
            return true;
        if (position.side === 'Sell' && ai.decision === 'BUY')
            return true;
        // Cerrar si hay pérdida significativa
        if (position.pnlPercentage < -5)
            return true;
        // Cerrar si hay ganancia significativa y la IA sugiere HOLD
        if (position.pnlPercentage > 8 && ai.decision === 'HOLD')
            return true;
        // Cerrar si la confianza de la IA es muy baja
        if (ai.confidence < 0.3)
            return true;
        return false;
    }
    /**
     * Ejecuta una acción de trading
     */
    async executeTradingAction(signal) {
        try {
            this.logger.info('=== INICIO EJECUCIÓN DE TRADE ===');
            this.logger.info(`Señal: ${JSON.stringify(signal)}`);
            // Validar con risk manager
            this.logger.info('Validando con Risk Manager...');
            const riskValidation = await this.riskManager.validateTrade({
                symbol: signal.symbol,
                side: signal.action === 'BUY' ? 'Buy' : 'Sell',
                quantity: signal.quantity,
                leverage: signal.leverage,
                stopLoss: signal.stopLoss,
                takeProfit: signal.takeProfit
            });
            this.logger.info(`Resultado validación: ${JSON.stringify(riskValidation)}`);
            if (!riskValidation.approved) {
                this.logger.warn(`Trade rechazado por gestión de riesgo: ${riskValidation.reason}`);
                return;
            }
            this.logger.info('Trade aprobado por Risk Manager, ejecutando...');
            if (signal.action === 'CLOSE') {
                await this.bybit.closePosition(signal.symbol, signal.quantity > 0 ? 'Buy' : 'Sell');
                this.logger.trade('CLOSE', {
                    symbol: signal.symbol,
                    quantity: signal.quantity
                });
            }
            else {
                const result = await this.bybit.executeTrade({
                    symbol: signal.symbol,
                    side: signal.action === 'BUY' ? 'Buy' : 'Sell',
                    quantity: signal.quantity,
                    leverage: signal.leverage,
                    stopLoss: signal.stopLoss,
                    takeProfit: signal.takeProfit
                });
                this.logger.trade('OPEN', {
                    symbol: signal.symbol,
                    side: signal.action,
                    quantity: signal.quantity,
                    price: result.price,
                    pnl: 0
                });
                // Incrementar contador de trades
                this.riskManager.incrementTradeCounter();
            }
        }
        catch (error) {
            this.logger.error('Error ejecutando acción de trading:', error);
        }
    }
    /**
     * Calcula el leverage óptimo - OPTIMIZADO PARA APALANCAMIENTO ALTO
     */
    calculateOptimalLeverage(ai, technical, kalman) {
        let leverage = 5; // Base más alta
        // Ajustar según confianza de IA
        if (ai.confidence > 0.9)
            leverage += 20;
        else if (ai.confidence > 0.8)
            leverage += 15;
        else if (ai.confidence > 0.7)
            leverage += 10;
        else if (ai.confidence > 0.6)
            leverage += 5;
        // Ajustar según predicción Kalman
        if (kalman.confidence > 0.8)
            leverage += 10;
        else if (kalman.confidence > 0.7)
            leverage += 5;
        // Ajustar según RSI (señales fuertes)
        if (technical.rsi < 25 || technical.rsi > 75)
            leverage += 10;
        else if (technical.rsi < 30 || technical.rsi > 70)
            leverage += 5;
        // Ajustar según MACD
        if (Math.abs(technical.macd.histogram) > 0.001)
            leverage += 5;
        // Ajustar según volumen
        if (technical.volume.ratio > 2)
            leverage += 5;
        // Limitar leverage máximo a 50x
        return Math.min(leverage, 50);
    }
    /**
     * Calcula el tamaño de posición - OPTIMIZADO PARA APALANCAMIENTO ALTO
     */
    async calculatePositionSize(symbol, price, leverage) {
        try {
            const balance = await this.bybit.getBalance();
            const symbolInfo = await this.bybit.getSymbolInfo(symbol);
            // Para apalancamiento alto, usar más del balance disponible - MÁS AGRESIVO
            const riskPercentage = Math.min(20, leverage / 2); // 1% a 20% según leverage
            const maxPositionValue = balance.availableBalance * (riskPercentage / 100);
            // Con apalancamiento alto, podemos usar más capital
            const positionValue = maxPositionValue * leverage;
            const quantity = positionValue / price;
            // Redondear según step size del símbolo
            const stepSize = symbolInfo.stepSize;
            const finalQuantity = Math.floor(quantity / stepSize) * stepSize;
            // Mínimo de 0.001 para asegurar que hay posición
            return Math.max(finalQuantity, 0.001);
        }
        catch (error) {
            this.logger.error('Error calculando tamaño de posición:', error);
            return 0.001; // Mínimo para testing
        }
    }
    /**
     * Calcula el stop loss
     */
    calculateStopLoss(price, decision, _technical) {
        const stopLossPercentage = 0.02; // 2%
        if (decision === 'BUY') {
            return price * (1 - stopLossPercentage);
        }
        else {
            return price * (1 + stopLossPercentage);
        }
    }
    /**
     * Calcula el take profit
     */
    calculateTakeProfit(price, stopLoss, confidence) {
        const riskRewardRatio = 2 + (confidence * 2); // 2-4 basado en confianza
        const stopLossDistance = Math.abs(price - stopLoss);
        const takeProfitDistance = stopLossDistance * riskRewardRatio;
        return price > stopLoss
            ? price + takeProfitDistance
            : price - takeProfitDistance;
    }
    /**
     * Construye el prompt para IA - OPTIMIZADO PARA TRADING AGRESIVO
     */
    buildAIPrompt(marketData, technical, kalman, klines) {
        const recentPrices = klines.slice(-10).map(k => k.close);
        const priceChange = ((recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0]) * 100;
        return `
Eres un trader profesional especializado en trading de alta frecuencia con apalancamiento. 
Analiza la siguiente información y toma decisiones AGRESIVAS basadas en señales claras:

DATOS DE MERCADO:
- Precio actual: $${marketData.price}
- Cambio 24h: ${marketData.change24h.toFixed(2)}%
- Volumen 24h: ${marketData.volume}
- Cambio reciente: ${priceChange.toFixed(2)}%

INDICADORES TÉCNICOS:
- RSI: ${technical.rsi.toFixed(2)} ${technical.rsi < 30 ? '(OVERSOLD - SEÑAL COMPRA)' : technical.rsi > 70 ? '(OVERBOUGHT - SEÑAL VENTA)' : ''}
- MACD: ${technical.macd.macd.toFixed(4)} (Signal: ${technical.macd.signal.toFixed(4)}) ${technical.macd.histogram > 0 ? '(BULLISH)' : '(BEARISH)'}
- Bollinger: Superior ${technical.bollinger.upper.toFixed(2)}, Medio ${technical.bollinger.middle.toFixed(2)}, Inferior ${technical.bollinger.lower.toFixed(2)}
- EMA9: ${technical.ema.ema9.toFixed(2)}, EMA21: ${technical.ema.ema21.toFixed(2)}, EMA50: ${technical.ema.ema50.toFixed(2)}
- Volumen: ${technical.volume.ratio.toFixed(2)}x promedio ${technical.volume.ratio > 1.5 ? '(ALTO VOLUMEN)' : ''}

PREDICCIÓN KALMAN:
- Precio predicho: $${kalman.predictedPrice.toFixed(2)}
- Confianza: ${(kalman.confidence * 100).toFixed(1)}%
- Tendencia: ${kalman.trend}
- Precisión: ${(kalman.accuracy * 100).toFixed(1)}%

INSTRUCCIONES DE TRADING:
- Si RSI < 30 y MACD bullish → COMPRA AGRESIVA
- Si RSI > 70 y MACD bearish → VENTA AGRESIVA  
- Si Kalman predice subida con alta confianza → COMPRA
- Si Kalman predice bajada con alta confianza → VENTA
- Si hay alta volatilidad y volumen → TRADING AGRESIVO
- Usa leverage alto (10-50x) para señales fuertes
- Solo HOLD si no hay señales claras

Proporciona tu decisión en formato JSON:
{
  "decision": "BUY|SELL|HOLD",
  "confidence": 0.0-1.0,
  "reasoning": "Explicación detallada de la señal",
  "suggestedLeverage": 10-50,
  "riskLevel": "low|medium|high",
  "marketSentiment": "bullish|bearish|neutral"
}

Sé AGRESIVO y toma decisiones basadas en señales claras. Evita HOLD a menos que sea absolutamente necesario.
    `;
    }
    /**
     * Verifica la salud del sistema
     */
    async healthCheck() {
        const ollamaHealth = await this.ollama.healthCheck();
        const bybitHealth = await this.bybit.healthCheck();
        if (!ollamaHealth) {
            throw new Error('Ollama no está disponible');
        }
        if (!bybitHealth) {
            throw new Error('Bybit no está disponible');
        }
        this.logger.info('Health check completado exitosamente');
    }
    /**
     * Convierte intervalo a milisegundos
     */
    getIntervalMs(interval) {
        const intervals = {
            '1m': 60 * 1000,
            '5m': 5 * 60 * 1000,
            '15m': 15 * 60 * 1000,
            '1h': 60 * 60 * 1000
        };
        return intervals[interval] || 5 * 60 * 1000;
    }
    /**
     * Espera a que se recopilen suficientes datos
     */
    async waitForData(symbol, maxWaitTime = 60000) {
        const startTime = Date.now();
        while (!this.dataManager.hasEnoughData(symbol, 50)) {
            if (Date.now() - startTime > maxWaitTime) {
                throw new Error(`Timeout esperando datos para ${symbol}`);
            }
            const stats = this.dataManager.getBufferStats(symbol);
            this.logger.info(`Recopilando datos para ${symbol}: ${stats.totalKlines}/50 velas`);
            await this.sleep(2000);
        }
        this.logger.info(`Datos suficientes recopilados para ${symbol}`);
    }
    /**
     * Función de sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.TradingStrategy = TradingStrategy;
//# sourceMappingURL=trading-strategy.js.map