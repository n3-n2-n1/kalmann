import { Kline, AIAnalysis, TechnicalIndicators, KalmanPrediction, TradeSignal } from '../types';
import { Logger } from '../utils/logger';
import { OllamaClient } from '../ai/ollama-client';
import { TechnicalAnalysis } from '../analysis/technical-analysis';
import { KalmanFilter } from '../analysis/kalman-filter';
import { RiskManager } from '../risk/risk-manager';
import { BybitClient } from '../exchange/bybit-client';
import { DataManager } from '../data/data-manager';
import { getMetrics } from '../utils/metrics';
import { RedisHistoryManager } from '../data/redis-history';

/**
 * Estrategia de trading automatizada con IA
 * Combina análisis técnico, predicción Kalman y decisiones de IA
 */
export class TradingStrategy {
  private logger: Logger;
  private ollama: OllamaClient;
  private technical: TechnicalAnalysis;
  private kalman: KalmanFilter;
  private riskManager: RiskManager;
  private bybit: BybitClient;
  private dataManager: DataManager;
  private redisHistory: RedisHistoryManager;
  private isRunning: boolean = false;
  private positionTracking: Map<string, any> = new Map(); // Track posiciones para trailing stop

  constructor() {
    this.logger = new Logger('TradingStrategy');
    this.ollama = new OllamaClient();
    this.technical = new TechnicalAnalysis();
    this.kalman = new KalmanFilter();
    this.riskManager = new RiskManager();
    this.bybit = new BybitClient();
    this.dataManager = new DataManager();
    this.redisHistory = new RedisHistoryManager(process.env.TRADING_SYMBOL || 'BTCUSDT');
  }

  /**
   * Inicia la estrategia de trading
   */
  async start(symbol: string, interval: string = '5m'): Promise<void> {
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

    } catch (error) {
      this.logger.error('Error iniciando estrategia:', error);
      throw error;
    }
  }

  /**
   * Detiene la estrategia de trading
   */
  async stop(): Promise<void> {
    this.logger.system('TradingStrategy', 'stop');
    this.isRunning = false;
    this.dataManager.stopDataCollection();
  }

  /**
   * Loop principal de trading
   */
  private async tradingLoop(symbol: string, interval: string): Promise<void> {
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
        
        // Primero: gestionar posiciones existentes (trailing stop, estrategias de salida)
        await this.manageExistingPositions(symbol, analysis);
        
        // Luego: generar nuevas señales de trading si no hay posiciones
        const signal = await this.generateTradingSignal(symbol, analysis);
        
        // Ejecutar acción si es necesaria
        if (signal) {
          this.logger.info(`EJECUTANDO TRADE: ${signal.action} ${signal.quantity} ${signal.symbol}`);
          await this.executeTradingAction(signal);
        } else {
          this.logger.info('No se generó señal de trading, esperando siguiente ciclo');
        }

        // Esperar antes del siguiente ciclo
        await this.sleep(this.getIntervalMs(interval));

      } catch (error) {
        this.logger.error('Error en loop de trading:', error);
        await this.sleep(30000); // Esperar 30 segundos en caso de error
      }
    }
  }

  /**
   * Realiza análisis completo del mercado
   */
  private async performCompleteAnalysis(symbol: string, klines: Kline[]): Promise<{
    technical: TechnicalIndicators;
    kalman: KalmanPrediction;
    ai: AIAnalysis;
    marketData: any;
  }> {
    const startTime = Date.now();
    
    // Análisis técnico
    const technical = await this.technical.analyze(klines);
    
    // Predicción Kalman
    const kalman = await this.kalman.predict(klines);
    
    // Datos de mercado
    const marketData = await this.bybit.getMarketData(symbol);
    
    // Obtener contexto histórico de Redis
    const historicalContext = await this.redisHistory.getContextForAI();
    
    // Análisis de IA con contexto histórico
    const aiPrompt = this.buildAIPrompt(marketData, technical, kalman, klines, historicalContext);
    const ai = await this.ollama.analyze(aiPrompt);
    
    this.logger.aiAnalysis({
      symbol,
      decision: ai.decision,
      confidence: ai.confidence,
      reasoning: ai.reasoning,
      indicators: technical
    });

    // Actualizar métricas
    try {
      const metrics = getMetrics();
      
      // Métricas de IA y Kalman
      metrics.updateAIMetrics({
        confidence: ai.confidence,
        decision: ai.decision,
        kalmanConfidence: kalman.confidence
      });
      
      // Métricas de indicadores técnicos
      metrics.updateTechnicalIndicators({
        rsi: technical.rsi,
        macdHistogram: technical.macd.histogram,
        macdLine: technical.macd.macd,
        macdSignal: technical.macd.signal
      });
      
      // Duración del análisis
      const duration = (Date.now() - startTime) / 1000;
      metrics.recordAnalysisDuration(duration);
    } catch (error) {
      // Ignorar error si métricas no están inicializadas
    }

    return { technical, kalman, ai, marketData };
  }

  /**
   * Genera señal de trading basada en el análisis
   */
  private async generateTradingSignal(symbol: string, analysis: any): Promise<TradeSignal | null> {
    const { technical, kalman, ai, marketData } = analysis;
    
    // Verificar si ya tenemos una posición abierta
    const existingPositions = await this.bybit.getPositions(symbol);
    
    if (existingPositions.length > 0) {
      const position = existingPositions[0];
      const positionSide = position.side; // 'Buy' o 'Sell'
      
      // LÓGICA CRÍTICA: No permitir abrir posición contraria ni duplicar
      if (positionSide === 'Buy' && ai.decision === 'BUY') {
        this.logger.info('⚠️  Ya tenemos posición LONG abierta, IA sugiere BUY pero no abriremos otra. Esperando gestión de posición existente.');
        return null;
      }
      
      if (positionSide === 'Sell' && ai.decision === 'SELL') {
        this.logger.info('⚠️  Ya tenemos posición SHORT abierta, IA sugiere SELL pero no abriremos otra. Esperando gestión de posición existente.');
        return null;
      }
      
      if (positionSide === 'Buy' && ai.decision === 'SELL') {
        this.logger.info('🔴 Tenemos LONG abierto pero IA sugiere SHORT. NO abriremos SHORT (sería hedging). La IA debería cerrar el LONG primero en manageExistingPositions.');
        return null;
      }
      
      if (positionSide === 'Sell' && ai.decision === 'BUY') {
        this.logger.info('🔴 Tenemos SHORT abierto pero IA sugiere LONG. NO abriremos LONG (sería hedging). La IA debería cerrar el SHORT primero en manageExistingPositions.');
        return null;
      }
      
      // Si llegamos aquí, hay una posición pero no entra en ninguna categoría (no debería pasar)
      this.logger.info('Ya existe una posición abierta, no se abrirá nueva posición');
      return null;
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
   * Ejecuta una acción de trading
   */
  private async executeTradingAction(signal: TradeSignal): Promise<void> {
    const startTime = Date.now();
    
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
        // Si hay parámetros ajustados sugeridos, intentar usar esos
        if (riskValidation.adjustedParams && riskValidation.adjustedParams.quantity > 0) {
          this.logger.info(`Trade ajustado por Risk Manager. Cantidad ajustada: ${riskValidation.adjustedParams.quantity}`);
          
          // Actualizar la señal con los parámetros ajustados
          signal.quantity = riskValidation.adjustedParams.quantity;
          signal.leverage = riskValidation.adjustedParams.leverage;
          signal.stopLoss = riskValidation.adjustedParams.stopLoss;
          signal.takeProfit = riskValidation.adjustedParams.takeProfit;
          
          this.logger.info(`Ejecutando trade con parámetros ajustados: ${signal.quantity} ${signal.symbol}`);
        } else {
        this.logger.warn(`Trade rechazado por gestión de riesgo: ${riskValidation.reason}`);
        return;
        }
      } else {
        this.logger.info('Trade aprobado por Risk Manager, ejecutando...');
      }

      if (signal.action === 'CLOSE') {
        await this.bybit.closePosition(signal.symbol, signal.quantity > 0 ? 'Buy' : 'Sell');
        this.logger.trade('CLOSE', {
          symbol: signal.symbol,
          quantity: signal.quantity
        });
        
        // Actualizar métricas
        try {
          const metrics = getMetrics();
          metrics.recordTrade(signal.quantity > 0 ? 'buy' : 'sell', true);
        } catch (error) {
          // Ignorar
        }
      } else {
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

        // Registrar apertura en Redis
        const tradeId = await this.redisHistory.recordTradeOpen({
          action: signal.action,
          confidence: signal.aiAnalysis.confidence,
          price: result.price,
          rsi: signal.aiAnalysis.indicators?.rsi || 0,
          macdHistogram: signal.aiAnalysis.indicators?.macd?.histogram || 0,
          kalmanTrend: signal.aiAnalysis.marketSentiment || 'neutral',
          leverage: signal.leverage,
          quantity: signal.quantity
        });
        
        // Guardar tradeId en tracking
        const trackingKey = `${signal.symbol}_${signal.action === 'BUY' ? 'Buy' : 'Sell'}`;
        if (!this.positionTracking.has(trackingKey)) {
          this.positionTracking.set(trackingKey, {
            symbol: signal.symbol,
            side: signal.action === 'BUY' ? 'Buy' : 'Sell',
            entryPrice: result.price,
            entryTime: Date.now(),
            maxPriceReached: result.price,
            minPriceReached: result.price,
            trailingStopActive: false,
            profitLadderExecuted: [],
            lastOrderCheckTime: Date.now(),
            tradeId: tradeId  // Guardar ID para cerrar después
          });
        }

        // Incrementar contador de trades
        this.riskManager.incrementTradeCounter();
        
        // Actualizar métricas
        try {
          const metrics = getMetrics();
          metrics.recordTrade(signal.action === 'BUY' ? 'buy' : 'sell', true);
          
          // Obtener balance actualizado
          const balance = await this.bybit.getBalance();
          metrics.updateTradingMetrics({
            balanceAvailable: balance.availableBalance,
            balanceTotal: balance.totalBalance,
            positionSize: signal.quantity,
            positionLeverage: signal.leverage
          });
          
          // Duración de ejecución
          const duration = (Date.now() - startTime) / 1000;
          metrics.recordTradeExecutionDuration(duration);
        } catch (error) {
          // Ignorar error si métricas no están inicializadas
        }
      }

    } catch (error) {
      this.logger.error('Error ejecutando acción de trading:', error);
      
      // Registrar error en métricas
      try {
        const metrics = getMetrics();
        metrics.recordError('trade_execution');
      } catch (e) {
        // Ignorar
      }
    }
  }

  /**
   * Gestiona posiciones existentes: trailing stop y estrategias de salida
   */
  private async manageExistingPositions(symbol: string, analysis: any): Promise<void> {
    try {
      const positions = await this.bybit.getPositions(symbol);
      
      // Actualizar métricas de posiciones
      try {
        const metrics = getMetrics();
        metrics.updateTradingMetrics({
          positionsOpen: positions.length
        });
        
        if (positions.length > 0) {
          const position = positions[0];
          metrics.updateTradingMetrics({
            positionPnlPercent: position.pnlPercentage,
            positionSize: position.size,
            positionLeverage: position.leverage || 1
          });
          
          // Actualizar PnL
          const balance = await this.bybit.getBalance();
          metrics.updateTradingMetrics({
            pnlUnrealized: position.pnl || 0,
            balanceAvailable: balance.availableBalance,
            balanceTotal: balance.totalBalance
          });
        }
      } catch (error) {
        // Ignorar error de métricas
      }
      
      if (positions.length === 0) {
        return; // No hay posiciones que gestionar
      }

      for (const position of positions) {
        this.logger.info(`📊 Gestionando posición: ${position.side} ${position.size} ${position.symbol} | PnL: ${position.pnlPercentage.toFixed(2)}%`);
        
        // Inicializar tracking si no existe
        const trackingKey = `${position.symbol}_${position.side}`;
        if (!this.positionTracking.has(trackingKey)) {
          this.positionTracking.set(trackingKey, {
            symbol: position.symbol,
            side: position.side,
            entryPrice: position.entryPrice,
            entryTime: Date.now(),
            maxPriceReached: position.currentPrice,
            minPriceReached: position.currentPrice,
            trailingStopActive: false,
            profitLadderExecuted: [],
            lastOrderCheckTime: Date.now() - 300000 // Últimos 5 minutos
          });
        }

        const tracking = this.positionTracking.get(trackingKey);
        
        // Verificar si hubo ejecuciones de TP/SL por Bybit
        try {
          const tpslCheck = await this.bybit.checkTPSLExecutions(
            position.symbol, 
            tracking.lastOrderCheckTime
          );
          
          if (tpslCheck.tpExecuted) {
            this.logger.info(`🎯 TAKE PROFIT EJECUTADO por Bybit para ${position.symbol}`);
            this.logger.info(`💰 Detalles: ${JSON.stringify(tpslCheck.orders[0], null, 2)}`);
            
            // Loguear evento para Grafana
            this.logger.info('TRADE_CLOSE', {
              symbol: position.symbol,
              side: position.side,
              type: 'TAKE_PROFIT',
              executedBy: 'Bybit',
              pnl: position.pnl,
              pnlPercentage: position.pnlPercentage,
              timestamp: Date.now()
            });
            
            // Registrar cierre en Redis
            if (tracking.tradeId) {
              const durationMinutes = (Date.now() - tracking.entryTime) / (1000 * 60);
              await this.redisHistory.recordTradeClose(tracking.tradeId, {
                type: 'TAKE_PROFIT',
                price: position.currentPrice,
                pnl: position.pnl,
                pnlPercent: position.pnlPercentage,
                durationMinutes
              });
            }
            
            // Actualizar métricas
            const metrics = getMetrics();
            metrics.recordTrade(position.side === 'Buy' ? 'buy' : 'sell', true);
          }
          
          if (tpslCheck.slExecuted) {
            this.logger.info(`🛑 STOP LOSS EJECUTADO por Bybit para ${position.symbol}`);
            this.logger.info(`💔 Detalles: ${JSON.stringify(tpslCheck.orders[0], null, 2)}`);
            
            // Loguear evento para Grafana
            this.logger.info('TRADE_CLOSE', {
              symbol: position.symbol,
              side: position.side,
              type: 'STOP_LOSS',
              executedBy: 'Bybit',
              pnl: position.pnl,
              pnlPercentage: position.pnlPercentage,
              timestamp: Date.now()
            });
            
            // Registrar cierre en Redis
            if (tracking.tradeId) {
              const durationMinutes = (Date.now() - tracking.entryTime) / (1000 * 60);
              await this.redisHistory.recordTradeClose(tracking.tradeId, {
                type: 'STOP_LOSS',
                price: position.currentPrice,
                pnl: position.pnl,
                pnlPercent: position.pnlPercentage,
                durationMinutes
              });
            }
            
            // Actualizar métricas
            const metrics = getMetrics();
            metrics.recordTrade(position.side === 'Buy' ? 'buy' : 'sell', false);
          }
          
          // Actualizar timestamp de última verificación
          tracking.lastOrderCheckTime = Date.now();
        } catch (error) {
          this.logger.debug('Error verificando órdenes TP/SL:', error);
        }
        
        // Actualizar precios máximo/mínimo
        if (position.side === 'Buy') {
          tracking.maxPriceReached = Math.max(tracking.maxPriceReached, position.currentPrice);
        } else {
          tracking.minPriceReached = Math.min(tracking.minPriceReached, position.currentPrice);
        }

        // Verificar y actualizar trailing stop
        await this.updateTrailingStop(position, tracking, analysis);
        
        // PRIMERO: Consultar a Ollama/IA sobre la posición
        const timeInPosition = (Date.now() - tracking.entryTime) / (1000 * 60 * 60); // Horas
        const marketData = await this.bybit.getMarketData(position.symbol);
        
        this.logger.info(`🤖 Consultando IA sobre posición ${position.symbol}...`);
        const aiDecision = await this.ollama.analyzePosition(
          position,
          marketData,
          analysis.technical,
          analysis.kalman,
          timeInPosition
        );
        
        this.logger.info(`📊 IA: ${aiDecision.action} | Razón: ${aiDecision.reasoning.substring(0, 100)}...`);
        
        // Si IA sugiere cerrar, ejecutar
        if (aiDecision.action !== 'HOLD') {
          const exitDecision = {
            action: aiDecision.action === 'CLOSE_100' ? 'CLOSE_FULL' : aiDecision.action,
            bestStrategy: {
              name: 'AI_DECISION',
              reason: aiDecision.reasoning,
              score: aiDecision.confidence
            },
            strategies: [{
              name: 'AI_DECISION',
              triggered: true,
              score: aiDecision.confidence,
              reason: aiDecision.reasoning,
              action: aiDecision.action === 'CLOSE_100' ? 'CLOSE_FULL' : aiDecision.action
            }],
            reasons: [aiDecision.reasoning]
          };
          
          await this.executeExitAction(position, exitDecision);
          
          // Si cerramos completamente, limpiar tracking
          if (exitDecision.action === 'CLOSE_FULL') {
            this.positionTracking.delete(trackingKey);
          }
        } else {
          // Si IA dice HOLD, evaluar estrategias automáticas de respaldo
          this.logger.info('IA sugiere HOLD, evaluando estrategias de respaldo...');
          const exitDecision = await this.evaluateExitStrategies(position, tracking, analysis);
          
          // Ejecutar acción recomendada
          if (exitDecision.action !== 'HOLD') {
            await this.executeExitAction(position, exitDecision);
            
            // Si cerramos completamente, limpiar tracking
            if (exitDecision.action === 'CLOSE_FULL') {
              this.positionTracking.delete(trackingKey);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Error gestionando posiciones existentes:', error);
    }
  }

  /**
   * Actualiza el trailing stop de una posición
   */
  private async updateTrailingStop(position: any, tracking: any, _analysis: any): Promise<void> {
    try {
      const pnlPercentage = position.pnlPercentage;
      const TRAILING_ACTIVATION_THRESHOLD = 0.5; // SCALPING: Activar trailing con solo 0.5% ganancia
      const TRAILING_DISTANCE = 0.3; // SCALPING: Mantener SL a 0.3% del máximo alcanzado

      // Activar trailing stop si tenemos suficiente ganancia
      if (pnlPercentage >= TRAILING_ACTIVATION_THRESHOLD && !tracking.trailingStopActive) {
        tracking.trailingStopActive = true;
        this.logger.info(`🎯 Trailing stop ACTIVADO para ${position.symbol} (PnL: ${pnlPercentage.toFixed(2)}%)`);
      }

      // Si el trailing stop está activo, actualizar SL
      if (tracking.trailingStopActive) {
        let newStopLoss: number;
        
        if (position.side === 'Buy') {
          // Para LONG: SL = maxPrice * 0.98 (2% bajo el máximo)
          newStopLoss = tracking.maxPriceReached * (1 - TRAILING_DISTANCE / 100);
          
          // Solo actualizar si el nuevo SL es más alto que el actual
          if (newStopLoss > position.entryPrice * 0.98) {  // Asegurar que esté por encima del SL original
            this.logger.info(`📈 Actualizando trailing SL: ${newStopLoss.toFixed(2)} (Max alcanzado: ${tracking.maxPriceReached.toFixed(2)})`);
            await this.bybit.updatePositionStopLoss(position.symbol, newStopLoss);
          }
        } else {
          // Para SHORT: SL = minPrice * 1.02 (2% sobre el mínimo)
          newStopLoss = tracking.minPriceReached * (1 + TRAILING_DISTANCE / 100);
          
          // Solo actualizar si el nuevo SL es más bajo que el actual
          if (newStopLoss < position.entryPrice * 1.02) {
            this.logger.info(`📉 Actualizando trailing SL: ${newStopLoss.toFixed(2)} (Min alcanzado: ${tracking.minPriceReached.toFixed(2)})`);
            await this.bybit.updatePositionStopLoss(position.symbol, newStopLoss);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error actualizando trailing stop:', error);
    }
  }

  /**
   * Evalúa todas las estrategias de salida y retorna recomendación
   */
  private async evaluateExitStrategies(position: any, tracking: any, analysis: any): Promise<any> {
    const strategies: any[] = [];
    const { ai, technical } = analysis;
    
    const timeInPosition = (Date.now() - tracking.entryTime) / (1000 * 60 * 60); // Horas
    const pnlPercentage = position.pnlPercentage;

    // ESTRATEGIA 1: Señal contraria de IA
    if (
      (position.side === 'Buy' && ai.decision === 'SELL' && ai.confidence > 0.7) ||
      (position.side === 'Sell' && ai.decision === 'BUY' && ai.confidence > 0.7)
    ) {
      strategies.push({
        name: 'AI_REVERSAL_SIGNAL',
        triggered: true,
        score: 1.0,
        reason: `IA sugiere ${ai.decision} con ${(ai.confidence * 100).toFixed(0)}% confianza`,
        action: 'CLOSE_FULL'
      });
    }

    // ESTRATEGIA 2: Time-based exit - SCALPING: más agresivo
    if (timeInPosition > 2 && pnlPercentage < 0.3) {
      strategies.push({
        name: 'POSITION_STALE',
        triggered: true,
        score: 0.6,
        reason: `Posición abierta ${timeInPosition.toFixed(1)}h sin movimiento (scalping)`,
        action: 'CLOSE_FULL'
      });
    }

    // ESTRATEGIA 3: Volatility spike exit
    if (technical.volume.ratio > 5) {
      strategies.push({
        name: 'VOLATILITY_SPIKE',
        triggered: true,
        score: 0.7,
        reason: `Volumen ${technical.volume.ratio.toFixed(1)}x promedio - posible reversión`,
        action: 'CLOSE_50'
      });
    }

    // ESTRATEGIA 4: Profit ladder - SCALPING: niveles más bajos y agresivos
    if (pnlPercentage >= 0.3 && !tracking.profitLadderExecuted.includes(30)) {
      strategies.push({
        name: 'PROFIT_LADDER_30',
        triggered: true,
        score: 0.5,
        reason: `PnL ${pnlPercentage.toFixed(2)}% - scalping: asegurar ganancia mínima`,
        action: 'CLOSE_25'
      });
    } else if (pnlPercentage >= 0.6 && !tracking.profitLadderExecuted.includes(60)) {
      strategies.push({
        name: 'PROFIT_LADDER_60',
        triggered: true,
        score: 0.6,
        reason: `PnL ${pnlPercentage.toFixed(2)}% - scalping: tomar profit parcial`,
        action: 'CLOSE_50'
      });
    } else if (pnlPercentage >= 1.0 && !tracking.profitLadderExecuted.includes(100)) {
      strategies.push({
        name: 'PROFIT_LADDER_100',
        triggered: true,
        score: 0.9,
        reason: `PnL ${pnlPercentage.toFixed(2)}% - scalping: excelente ganancia, cerrar todo`,
        action: 'CLOSE_FULL'
      });
    }

    // ESTRATEGIA 5: RSI extremo + MACD contradicción
    if (position.side === 'Buy') {
      if (technical.rsi > 80 && technical.macd.histogram < 0) {
        strategies.push({
          name: 'TECHNICAL_REVERSAL',
          triggered: true,
          score: 0.75,
          reason: 'RSI sobrecompra extrema + MACD bearish',
          action: 'CLOSE_50'
        });
      }
    } else {
      if (technical.rsi < 20 && technical.macd.histogram > 0) {
        strategies.push({
          name: 'TECHNICAL_REVERSAL',
          triggered: true,
          score: 0.75,
          reason: 'RSI sobreventa extrema + MACD bullish',
          action: 'CLOSE_50'
        });
      }
    }

    // Decidir acción basada en la estrategia con mayor score
    if (strategies.length > 0) {
      const bestStrategy = strategies.reduce((prev, current) => 
        (prev.score > current.score) ? prev : current
      );
      
      this.logger.info(`⚠️  Estrategia activada: ${bestStrategy.name} - ${bestStrategy.reason}`);
      
      return {
        action: bestStrategy.action,
        strategies,
        bestStrategy,
        reasons: strategies.map(s => s.reason)
      };
    }

    return { action: 'HOLD', strategies: [], reasons: [] };
  }

  /**
   * Ejecuta la acción de salida recomendada
   */
  private async executeExitAction(position: any, exitDecision: any): Promise<void> {
    try {
      const { action, bestStrategy } = exitDecision;
      const trackingKey = `${position.symbol}_${position.side}`;
      const tracking = this.positionTracking.get(trackingKey);
      
      switch (action) {
        case 'CLOSE_FULL':
        case 'CLOSE_100':
          this.logger.info(`🔴 CERRANDO POSICIÓN COMPLETA: ${bestStrategy.reason}`);
          await this.bybit.closePosition(position.symbol, position.side, 100);
          this.logger.info(`💰 Posición cerrada. PnL final: ${position.pnl.toFixed(2)} USDT (${position.pnlPercentage.toFixed(3)}%)`);
          
          // Registrar cierre en Redis
          if (tracking?.tradeId) {
            const durationMinutes = (Date.now() - tracking.entryTime) / (1000 * 60);
            await this.redisHistory.recordTradeClose(tracking.tradeId, {
              type: 'MANUAL_CLOSE',
              price: position.currentPrice,
              pnl: position.pnl,
              pnlPercent: position.pnlPercentage,
              durationMinutes
            });
          }
          break;
          
        case 'CLOSE_50':
          this.logger.info(`🟡 CERRANDO 50% DE POSICIÓN: ${bestStrategy.reason}`);
          await this.bybit.closePosition(position.symbol, position.side, 50);
          this.logger.info(`💰 50% cerrado. PnL parcial: ${(position.pnl / 2).toFixed(2)} USDT`);
          break;
          
        case 'CLOSE_25':
          this.logger.info(`🟢 CERRANDO 25% DE POSICIÓN: ${bestStrategy.reason}`);
          await this.bybit.closePosition(position.symbol, position.side, 25);
          this.logger.info(`💰 25% cerrado. PnL parcial: ${(position.pnl / 4).toFixed(2)} USDT`);
          
          // Marcar nivel de profit ladder como ejecutado
          if (tracking && bestStrategy.name.includes('PROFIT_LADDER')) {
            const levelMatch = bestStrategy.name.match(/\d+$/);
            if (levelMatch) {
              const level = parseInt(levelMatch[0]);
              tracking.profitLadderExecuted.push(level);
            }
          }
          break;
      }
      
      this.logger.info(`✅ Acción ejecutada exitosamente`);
    } catch (error) {
      this.logger.error('Error ejecutando acción de salida:', error);
    }
  }

  /**
   * Calcula el leverage óptimo - AJUSTADO PARA SCALPING (MÁS CONSERVADOR)
   */
  private calculateOptimalLeverage(ai: AIAnalysis, technical: TechnicalIndicators, kalman: KalmanPrediction): number {
    let leverage = 5; // Base conservadora para scalping

    // Ajustar según confianza de IA (más conservador)
    if (ai.confidence > 0.9) leverage += 10;
    else if (ai.confidence > 0.8) leverage += 7;
    else if (ai.confidence > 0.7) leverage += 5;
    else if (ai.confidence > 0.6) leverage += 3;

    // Ajustar según predicción Kalman (más conservador)
    if (kalman.confidence > 0.85) leverage += 5;
    else if (kalman.confidence > 0.75) leverage += 3;

    // Ajustar según RSI (señales fuertes)
    if (technical.rsi < 25 || technical.rsi > 75) leverage += 5;
    else if (technical.rsi < 30 || technical.rsi > 70) leverage += 2;

    // Ajustar según MACD
    if (Math.abs(technical.macd.histogram) > 0.001) leverage += 2;

    // Ajustar según volumen
    if (technical.volume.ratio > 2) leverage += 2;

    // Para scalping: Limitar leverage máximo a 20x (más seguro)
    return Math.min(leverage, 20);
  }

  /**
   * Calcula el tamaño de posición - OPTIMIZADO PARA APALANCAMIENTO ALTO
   */
  private async calculatePositionSize(symbol: string, price: number, leverage: number): Promise<number> {
    try {
      const balance = await this.bybit.getBalance();
      this.logger.info(`Balance disponible: $${balance.availableBalance.toFixed(2)}, Precio: $${price}`);
      
      const symbolInfo = await this.bybit.getSymbolInfo(symbol);
      this.logger.debug(`Símbolo info - Min: ${symbolInfo.minOrderQty}, Step: ${symbolInfo.stepSize}`);
      
      // Validar inputs
      if (!balance.availableBalance || balance.availableBalance <= 0) {
        this.logger.error('Balance disponible es inválido');
        return 0.001;
      }
      
      if (!price || price <= 0) {
        this.logger.error('Precio es inválido');
        return 0.001;
      }
      
      // Para scalping: usar porcentaje MÁS CONSERVADOR del balance
      // Con leverage 15x y riskPercentage 7.5%, usamos ~$3k del balance disponible ($40k)
      // Eso nos da una posición de ~$45k con 15x leverage
      const riskPercentage = Math.min(10, leverage / 3); // 1.6% a 10% según leverage (más conservador)
      const capitalToRisk = balance.availableBalance * (riskPercentage / 100);
      
      this.logger.info(`Riesgo: ${riskPercentage}%, Capital a arriesgar: $${capitalToRisk.toFixed(2)}`);
      
      // El valor de la posición es el capital multiplicado por el leverage
      const positionValue = capitalToRisk * leverage;
      
      // Cantidad en BTC (o la moneda base)
      const quantity = positionValue / price;
      
      this.logger.info(`Position value: $${positionValue.toFixed(2)}, Quantity raw: ${quantity.toFixed(6)}`);
      
      // Validar que la cantidad no es NaN
      if (isNaN(quantity) || quantity <= 0) {
        this.logger.error(`Cantidad calculada es inválida: ${quantity}`);
        return 0.001;
      }
      
      // Redondear según step size del símbolo
      const stepSize = symbolInfo.stepSize || 0.001;
      let finalQuantity = Math.floor(quantity / stepSize) * stepSize;
      
      // Asegurar que cumple el mínimo
      const minQty = symbolInfo.minOrderQty || 0.001;
      if (finalQuantity < minQty) {
        finalQuantity = minQty;
        this.logger.warn(`Cantidad ajustada al mínimo: ${finalQuantity}`);
      }
      
      this.logger.info(`Cantidad final calculada: ${finalQuantity} ${symbol.replace('USDT', '')} (valor: $${(finalQuantity * price).toFixed(2)})`);
      
      return finalQuantity;
    } catch (error) {
      this.logger.error('Error calculando tamaño de posición:', error);
      // Retornar cantidad mínima por defecto
      return 0.001;
    }
  }

  /**
   * Calcula el stop loss - AJUSTADO PARA SCALPING
   */
  private calculateStopLoss(price: number, decision: string, _technical: TechnicalIndicators): number {
    const stopLossPercentage = 0.006; // 0.6% - Más conservador para scalping
    
    if (decision === 'BUY') {
      return price * (1 - stopLossPercentage);
    } else {
      return price * (1 + stopLossPercentage);
    }
  }

  /**
   * Calcula el take profit - AJUSTADO PARA SCALPING
   */
  private calculateTakeProfit(price: number, stopLoss: number, confidence: number): number {
    // Para scalping: TP más conservador, 1.5-2x el riesgo
    const riskRewardRatio = 1.5 + (confidence * 0.5); // 1.5-2.0 basado en confianza
    const stopLossDistance = Math.abs(price - stopLoss);
    const takeProfitDistance = stopLossDistance * riskRewardRatio;
    
    return price > stopLoss 
      ? price + takeProfitDistance
      : price - takeProfitDistance;
  }

  /**
   * Construye el prompt para IA - OPTIMIZADO PARA TRADING AGRESIVO
   */
  private buildAIPrompt(marketData: any, technical: TechnicalIndicators, kalman: KalmanPrediction, klines: Kline[], historicalContext?: any): string {
    const recentPrices = klines.slice(-10).map(k => k.close);
    const priceChange = ((recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0]) * 100;
    
    // Detectar contexto actual
    const isBullishContext = technical.rsi < 50 && technical.macd.histogram > 0 && priceChange > 0;
    const isBearishContext = technical.rsi > 50 && technical.macd.histogram < 0 && priceChange < 0;

    // Construir prompt con contexto histórico si está disponible
    let promptWithHistory = '';
    if (historicalContext && (historicalContext.recent.length > 0 || historicalContext.daily.trades > 0)) {
      promptWithHistory = this.redisHistory.formatContextForPrompt(historicalContext);
    }

    return `
${promptWithHistory}Eres un trader profesional de SCALPING bidireccional. Puedes ganar tanto en subidas (LONG/BUY) como en bajadas (SHORT/SELL).
IMPORTANTE: En crypto, los precios BAJAN tan rápido (o más rápido) que suben. Un SHORT puede ser tan rentable como un LONG.

⚠️  REGLA CRÍTICA: Solo puedes tener UNA posición a la vez (o LONG o SHORT, nunca ambos). Si detectas que debes cambiar de dirección, primero cierras la posición existente (se hace automáticamente) y luego sugieres la nueva dirección.

DATOS DE MERCADO:
- Precio actual: $${marketData.price}
- Cambio 24h: ${marketData.change24h.toFixed(2)}%
- Volumen 24h: ${marketData.volume}
- Cambio reciente (últimos 10 velas): ${priceChange.toFixed(2)}% ${priceChange > 0 ? '📈' : priceChange < 0 ? '📉' : '➡️'}

INDICADORES TÉCNICOS:
- RSI: ${technical.rsi.toFixed(2)} ${technical.rsi < 30 ? '🟢 OVERSOLD (señal LONG)' : technical.rsi > 70 ? '🔴 OVERBOUGHT (señal SHORT)' : technical.rsi > 60 ? '⚠️  Alto (posible SHORT)' : technical.rsi < 40 ? '⚠️  Bajo (posible LONG)' : ''}
- MACD Histogram: ${technical.macd.histogram.toFixed(6)} ${technical.macd.histogram > 0 ? '🟢 BULLISH' : '🔴 BEARISH'}
- MACD: ${technical.macd.macd.toFixed(4)} vs Signal: ${technical.macd.signal.toFixed(4)}
- Bollinger: Superior ${technical.bollinger.upper.toFixed(2)}, Medio ${technical.bollinger.middle.toFixed(2)}, Inferior ${technical.bollinger.lower.toFixed(2)}
  ${marketData.price > technical.bollinger.upper ? '🔴 Precio SOBRE banda superior (señal SHORT)' : marketData.price < technical.bollinger.lower ? '🟢 Precio BAJO banda inferior (señal LONG)' : ''}
- EMAs: EMA9: ${technical.ema.ema9.toFixed(2)}, EMA21: ${technical.ema.ema21.toFixed(2)}, EMA50: ${technical.ema.ema50.toFixed(2)}
  ${technical.ema.ema9 < technical.ema.ema21 && technical.ema.ema21 < technical.ema.ema50 ? '🔴 Death Cross (tendencia BAJISTA)' : technical.ema.ema9 > technical.ema.ema21 && technical.ema.ema21 > technical.ema.ema50 ? '🟢 Golden Cross (tendencia ALCISTA)' : ''}
- Volumen: ${technical.volume.ratio.toFixed(2)}x promedio ${technical.volume.ratio > 1.5 ? '⚡ ALTO VOLUMEN (movimiento fuerte)' : ''}

PREDICCIÓN KALMAN:
- Precio predicho: $${kalman.predictedPrice.toFixed(2)} (${kalman.predictedPrice > marketData.price ? '📈 +' : '📉 '}${((kalman.predictedPrice - marketData.price) / marketData.price * 100).toFixed(2)}%)
- Confianza: ${(kalman.confidence * 100).toFixed(1)}%
- Tendencia: ${kalman.trend === 'bullish' ? '🟢 ALCISTA' : kalman.trend === 'bearish' ? '🔴 BAJISTA' : '➡️  LATERAL'}
- Precisión: ${(kalman.accuracy * 100).toFixed(1)}%

═══════════════════════════════════════════════════════════════
📊 REGLAS DE DECISIÓN (BALANCEADAS LONG/SHORT):
═══════════════════════════════════════════════════════════════

🔴 SEÑALES PARA **SHORT** (SELL - apostar a la BAJADA):
1. RSI > 70 (sobrecompra) + MACD bearish → SHORT AGRESIVO
2. RSI entre 60-70 + MACD cruzando a negativo → SHORT MODERADO
3. Precio SOBRE Bollinger superior + volumen alto → SHORT (reversión inminente)
4. EMA9 cruza por DEBAJO de EMA21 → SHORT (death cross)
5. Kalman predice BAJADA con confianza > 75% → SHORT
6. Cambio reciente > +2% en 10 velas + RSI > 65 → SHORT (toma de ganancias esperada)
7. MACD histogram negativo Y decreciendo → SHORT (momentum bajista)

🟢 SEÑALES PARA **LONG** (BUY - apostar a la SUBIDA):
1. RSI < 30 (sobreventa) + MACD bullish → LONG AGRESIVO
2. RSI entre 30-40 + MACD cruzando a positivo → LONG MODERADO
3. Precio BAJO Bollinger inferior + volumen alto → LONG (reversión inminente)
4. EMA9 cruza por ENCIMA de EMA21 → LONG (golden cross)
5. Kalman predice SUBIDA con confianza > 75% → LONG
6. Cambio reciente < -2% en 10 velas + RSI < 35 → LONG (oversold extremo)
7. MACD histogram positivo Y creciendo → LONG (momentum alcista)

⚪ SEÑALES PARA **HOLD**:
- RSI entre 45-55 + MACD cerca de 0 → HOLD (mercado indeciso)
- Volumen bajo (<0.8x promedio) → HOLD (falta convicción)
- Kalman confianza < 60% → HOLD (predicción incierta)

═══════════════════════════════════════════════════════════════

IMPORTANTE:
✅ En scalping, los SHORTS son TAN IMPORTANTES como los LONGS
✅ Las caídas en crypto son RÁPIDAS y VIOLENTAS (alta volatilidad)
✅ NO tengas sesgo alcista: evalúa OBJETIVAMENTE
✅ Si hay señales bajistas CLARAS → SELL/SHORT sin miedo
✅ Usa leverage alto (10-50x) SOLO con señales muy claras
✅ En duda → HOLD (mejor perder una oportunidad que perder dinero)

Responde en formato JSON:
{
  "decision": "BUY|SELL|HOLD",
  "confidence": 0.0-1.0,
  "reasoning": "Explicación detallada mencionando ESPECÍFICAMENTE qué indicadores apoyan tu decisión (RSI, MACD, Bollinger, EMA, Kalman)",
  "suggestedLeverage": 10-50,
  "riskLevel": "low|medium|high",
  "marketSentiment": "bullish|bearish|neutral"
}

CONTEXTO ACTUAL DETECTADO: ${isBullishContext ? '🟢 Ligeramente alcista' : isBearishContext ? '🔴 Ligeramente bajista' : '⚪ Neutral'}
Analiza OBJETIVAMENTE y decide. Si detectas señales bajistas, NO dudes en sugerir SELL/SHORT.
    `;
  }

  /**
   * Verifica la salud del sistema
   */
  private async healthCheck(): Promise<void> {
    const ollamaHealth = await this.ollama.healthCheck();
    const bybitHealth = await this.bybit.healthCheck();

    // Actualizar métricas de salud
    try {
      const metrics = getMetrics();
      metrics.updateHealthMetrics({
        ollamaHealth,
        bybitHealth
      });
    } catch (error) {
      // Ignorar error si métricas no están inicializadas
    }

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
  private getIntervalMs(interval: string): number {
    const intervals: { [key: string]: number } = {
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
  private async waitForData(symbol: string, maxWaitTime: number = 60000): Promise<void> {
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
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
