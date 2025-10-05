"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskManager = void 0;
const logger_1 = require("../utils/logger");
const bybit_client_1 = require("../exchange/bybit-client");
/**
 * Sistema de gestión de riesgo inteligente
 * Protege el capital y optimiza la exposición al riesgo
 */
class RiskManager {
    logger;
    bybit;
    config;
    dailyTrades = 0;
    lastResetDate = '';
    constructor() {
        this.logger = new logger_1.Logger('RiskManager');
        this.bybit = new bybit_client_1.BybitClient();
        this.config = {
            symbol: process.env.TRADING_SYMBOL || 'BTCUSDT',
            maxLeverage: parseInt(process.env.MAX_LEVERAGE || '5'),
            maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '1000000'),
            riskPercentage: parseFloat(process.env.RISK_PERCENTAGE || '2'),
            stopLossPercentage: parseFloat(process.env.STOP_LOSS_PERCENTAGE || '3'),
            takeProfitPercentage: parseFloat(process.env.TAKE_PROFIT_PERCENTAGE || '6'),
            enablePaperTrading: process.env.PAPER_TRADING === 'true',
            maxDailyTrades: parseInt(process.env.MAX_DAILY_TRADES || '10')
        };
        this.logger.info('Risk Manager inicializado con configuración:', this.config);
    }
    /**
     * Valida si un trade es seguro para ejecutar
     */
    async validateTrade(tradeParams) {
        try {
            // Resetear contador diario si es necesario
            this.resetDailyCounterIfNeeded();
            // Verificar límites diarios
            if (this.dailyTrades >= this.config.maxDailyTrades) {
                return {
                    approved: false,
                    reason: `Límite diario de trades alcanzado: ${this.dailyTrades}/${this.config.maxDailyTrades}`,
                    riskScore: 1.0
                };
            }
            // Obtener balance actual
            const balance = await this.bybit.getBalance();
            // Calcular tamaño de posición máximo - AJUSTADO PARA SCALPING (más permisivo)
            const currentPrice = await this.getCurrentPrice(tradeParams.symbol);
            const requestedPositionValue = tradeParams.quantity * currentPrice;
            this.logger.info(`Validando posición: Cantidad=${tradeParams.quantity}, Precio=${currentPrice.toFixed(2)}, Valor=$${requestedPositionValue.toFixed(2)}`);
            // Verificar si la cantidad es válida
            if (!tradeParams.quantity || isNaN(tradeParams.quantity) || tradeParams.quantity <= 0) {
                return {
                    approved: false,
                    reason: `Cantidad de trade inválida: ${tradeParams.quantity}`,
                    riskScore: 1.0
                };
            }
            // Para scalping: Permitir trades más pequeños (hasta 30% del balance total)
            const maxAllowedValue = balance.totalBalance * 0.3;
            if (requestedPositionValue > maxAllowedValue) {
                const adjustedQuantity = Math.floor((maxAllowedValue / currentPrice) * 1000) / 1000; // Redondear a 3 decimales
                this.logger.warn(`Posición excede límite. Solicitado: $${requestedPositionValue.toFixed(2)}, Máximo: $${maxAllowedValue.toFixed(2)}`);
                return {
                    approved: false,
                    reason: `Posición excede límite de riesgo. Máximo: $${maxAllowedValue.toFixed(2)}`,
                    adjustedParams: { ...tradeParams, quantity: adjustedQuantity },
                    riskScore: 0.8
                };
            }
            // Verificar leverage
            const leverage = tradeParams.leverage || 1;
            if (leverage > this.config.maxLeverage) {
                return {
                    approved: false,
                    reason: `Leverage excede máximo permitido: ${leverage}/${this.config.maxLeverage}`,
                    riskScore: 0.9
                };
            }
            // Verificar posiciones existentes
            const existingPositions = await this.bybit.getPositions(tradeParams.symbol);
            const totalExposure = this.calculateTotalExposure(existingPositions);
            if (totalExposure + requestedPositionValue > this.config.maxPositionSize) {
                return {
                    approved: false,
                    reason: `Exposición total excedería límite: $${this.config.maxPositionSize}`,
                    riskScore: 0.7
                };
            }
            // Calcular score de riesgo
            const riskScore = await this.calculateRiskScore(tradeParams, balance, existingPositions);
            if (riskScore > 0.8) {
                return {
                    approved: false,
                    reason: `Score de riesgo demasiado alto: ${riskScore.toFixed(2)}`,
                    riskScore
                };
            }
            // Verificar stop loss y take profit
            const stopLossValidation = await this.validateStopLoss(tradeParams);
            if (!stopLossValidation.valid) {
                return {
                    approved: false,
                    reason: stopLossValidation.reason,
                    riskScore: 0.6
                };
            }
            this.logger.info(`Trade aprobado - Risk Score: ${riskScore.toFixed(2)}`);
            return {
                approved: true,
                reason: 'Trade aprobado por gestión de riesgo',
                riskScore
            };
        }
        catch (error) {
            this.logger.error('Error validando trade:', error);
            return {
                approved: false,
                reason: `Error en validación: ${error instanceof Error ? error.message : 'Error desconocido'}`,
                riskScore: 1.0
            };
        }
    }
    /**
     * Calcula el score de riesgo de un trade
     */
    async calculateRiskScore(tradeParams, balance, positions) {
        let riskScore = 0;
        // Factor de leverage (0-0.3)
        const leverage = tradeParams.leverage || 1;
        riskScore += (leverage / this.config.maxLeverage) * 0.3;
        // Factor de tamaño de posición (0-0.2)
        const positionRatio = (tradeParams.quantity * (await this.getCurrentPrice(tradeParams.symbol))) / balance.totalBalance;
        riskScore += Math.min(positionRatio * 2, 0.2);
        // Factor de exposición existente (0-0.2)
        const totalExposure = this.calculateTotalExposure(positions);
        const exposureRatio = totalExposure / balance.totalBalance;
        riskScore += Math.min(exposureRatio * 0.5, 0.2);
        // Factor de volatilidad del mercado (0-0.3)
        const volatilityRisk = await this.calculateVolatilityRisk(tradeParams.symbol);
        riskScore += volatilityRisk * 0.3;
        return Math.min(1, riskScore);
    }
    /**
     * Valida el stop loss
     */
    async validateStopLoss(tradeParams) {
        if (!tradeParams.stopLoss) {
            return { valid: false, reason: 'Stop loss es obligatorio' };
        }
        const currentPrice = await this.getCurrentPrice(tradeParams.symbol);
        const stopLossDistance = Math.abs(currentPrice - tradeParams.stopLoss) / currentPrice;
        // Permitir un margen del 5% sobre el límite configurado
        const maxAllowedDistance = (this.config.stopLossPercentage * 1.05) / 100;
        if (stopLossDistance > maxAllowedDistance) {
            return {
                valid: false,
                reason: `Stop loss demasiado lejos: ${(stopLossDistance * 100).toFixed(2)}% (máx permitido: ${(maxAllowedDistance * 100).toFixed(2)}%)`
            };
        }
        return { valid: true, reason: 'Stop loss válido' };
    }
    /**
     * Calcula la exposición total de las posiciones
     */
    calculateTotalExposure(positions) {
        return positions.reduce((total, pos) => {
            return total + (pos.size * pos.entryPrice);
        }, 0);
    }
    /**
     * Calcula el riesgo de volatilidad
     */
    async calculateVolatilityRisk(symbol) {
        try {
            // Obtener datos históricos para calcular volatilidad
            const klines = await this.bybit.getKlines(symbol, '5m', 20);
            const prices = klines.map(k => k.close);
            const returns = [];
            for (let i = 1; i < prices.length; i++) {
                returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
            }
            const variance = returns.reduce((sum, r) => sum + r * r, 0) / returns.length;
            const volatility = Math.sqrt(variance);
            // Normalizar volatilidad (0-1)
            return Math.min(1, volatility * 10);
        }
        catch (error) {
            this.logger.warn('Error calculando volatilidad, usando valor conservador');
            return 0.5; // Valor conservador
        }
    }
    /**
     * Obtiene el precio actual de un símbolo
     */
    async getCurrentPrice(symbol) {
        try {
            const marketData = await this.bybit.getMarketData(symbol);
            return marketData.price;
        }
        catch (error) {
            this.logger.error('Error obteniendo precio actual:', error);
            return 0;
        }
    }
    /**
     * Resetea el contador diario si es necesario
     */
    resetDailyCounterIfNeeded() {
        const today = new Date().toDateString();
        if (this.lastResetDate !== today) {
            this.dailyTrades = 0;
            this.lastResetDate = today;
            this.logger.info('Contador diario de trades reseteado');
        }
    }
    /**
     * Incrementa el contador de trades
     */
    incrementTradeCounter() {
        this.dailyTrades++;
        this.logger.debug(`Trades ejecutados hoy: ${this.dailyTrades}/${this.config.maxDailyTrades}`);
    }
    /**
     * Calcula el tamaño de posición óptimo
     */
    calculateOptimalPositionSize(accountBalance, riskPercentage, entryPrice, stopLossPrice) {
        const riskAmount = accountBalance * (riskPercentage / 100);
        const priceRisk = Math.abs(entryPrice - stopLossPrice);
        const optimalSize = riskAmount / priceRisk;
        return Math.floor(optimalSize * 100) / 100; // Redondear a 2 decimales
    }
    /**
     * Calcula el take profit basado en el stop loss
     */
    calculateTakeProfit(entryPrice, stopLossPrice, riskRewardRatio = 2) {
        const stopLossDistance = Math.abs(entryPrice - stopLossPrice);
        const takeProfitDistance = stopLossDistance * riskRewardRatio;
        return entryPrice > stopLossPrice
            ? entryPrice + takeProfitDistance
            : entryPrice - takeProfitDistance;
    }
    /**
     * Monitorea posiciones abiertas y sugiere acciones
     */
    async monitorPositions() {
        try {
            const positions = await this.bybit.getPositions();
            const alerts = [];
            const suggestedActions = [];
            for (const position of positions) {
                // Alertas de PnL
                if (position.pnlPercentage < -5) {
                    alerts.push(`Pérdida significativa en ${position.symbol}: ${position.pnlPercentage.toFixed(2)}%`);
                    suggestedActions.push(`Considerar cerrar posición ${position.symbol}`);
                }
                if (position.pnlPercentage > 10) {
                    alerts.push(`Ganancia significativa en ${position.symbol}: ${position.pnlPercentage.toFixed(2)}%`);
                    suggestedActions.push(`Considerar tomar ganancias en ${position.symbol}`);
                }
                // Alertas de exposición
                const positionValue = position.size * position.entryPrice;
                if (positionValue > this.config.maxPositionSize * 0.8) {
                    alerts.push(`Exposición alta en ${position.symbol}: $${positionValue.toFixed(2)}`);
                }
            }
            return { positions, alerts, suggestedActions };
        }
        catch (error) {
            this.logger.error('Error monitoreando posiciones:', error);
            return { positions: [], alerts: ['Error monitoreando posiciones'], suggestedActions: [] };
        }
    }
    /**
     * Actualiza la configuración de riesgo
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logger.info('Configuración de riesgo actualizada:', this.config);
    }
    /**
     * Obtiene estadísticas de riesgo
     */
    getRiskStats() {
        return {
            dailyTrades: this.dailyTrades,
            maxDailyTrades: this.config.maxDailyTrades,
            riskPercentage: this.config.riskPercentage,
            maxLeverage: this.config.maxLeverage,
            maxPositionSize: this.config.maxPositionSize
        };
    }
}
exports.RiskManager = RiskManager;
//# sourceMappingURL=risk-manager.js.map