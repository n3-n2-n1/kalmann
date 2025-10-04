"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TechnicalAnalysis = void 0;
const logger_1 = require("../utils/logger");
/**
 * Análisis técnico avanzado con múltiples indicadores
 * Proporciona señales de trading basadas en indicadores técnicos
 */
class TechnicalAnalysis {
    logger;
    constructor() {
        this.logger = new logger_1.Logger('TechnicalAnalysis');
    }
    /**
     * Realiza análisis técnico completo
     */
    async analyze(klines, period = 14) {
        try {
            if (klines.length < 50) {
                throw new Error('Se necesitan al menos 50 velas para análisis técnico');
            }
            const prices = klines.map(k => k.close);
            const volumes = klines.map(k => k.volume);
            // Calcular todos los indicadores
            const rsi = this.calculateRSI(prices, period);
            const macd = this.calculateMACD(prices);
            const bollinger = this.calculateBollingerBands(prices, 20, 2);
            const ema = this.calculateEMAs(prices);
            const volumeAnalysis = this.analyzeVolume(volumes);
            this.logger.debug(`Análisis técnico completado para ${klines.length} velas`);
            return {
                rsi,
                macd,
                bollinger,
                ema,
                volume: volumeAnalysis
            };
        }
        catch (error) {
            this.logger.error('Error en análisis técnico:', error);
            // Retornar indicadores neutros en caso de error
            return {
                rsi: 50,
                macd: { macd: 0, signal: 0, histogram: 0 },
                bollinger: { upper: 0, middle: 0, lower: 0 },
                ema: { ema9: 0, ema21: 0, ema50: 0 },
                volume: { avg: 0, current: 0, ratio: 1 }
            };
        }
    }
    /**
     * Calcula el RSI (Relative Strength Index)
     */
    calculateRSI(prices, period) {
        if (prices.length < period + 1)
            return 50;
        const gains = [];
        const losses = [];
        for (let i = 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            if (change > 0) {
                gains.push(change);
                losses.push(0);
            }
            else {
                gains.push(0);
                losses.push(Math.abs(change));
            }
        }
        const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
        const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
        if (avgLoss === 0)
            return 100;
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        return Math.max(0, Math.min(100, rsi));
    }
    /**
     * Calcula el MACD (Moving Average Convergence Divergence)
     */
    calculateMACD(prices) {
        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);
        const macd = ema12 - ema26;
        // Para el signal line, necesitaríamos más datos históricos
        // Por simplicidad, usamos una aproximación
        const signal = macd * 0.9; // Aproximación del signal line
        const histogram = macd - signal;
        return { macd, signal, histogram };
    }
    /**
     * Calcula las Bandas de Bollinger
     */
    calculateBollingerBands(prices, period, stdDev) {
        if (prices.length < period) {
            const lastPrice = prices[prices.length - 1];
            return { upper: lastPrice, middle: lastPrice, lower: lastPrice };
        }
        const recentPrices = prices.slice(-period);
        const sma = recentPrices.reduce((a, b) => a + b, 0) / period;
        const variance = recentPrices.reduce((sum, price) => {
            return sum + Math.pow(price - sma, 2);
        }, 0) / period;
        const standardDeviation = Math.sqrt(variance);
        return {
            upper: sma + (standardDeviation * stdDev),
            middle: sma,
            lower: sma - (standardDeviation * stdDev)
        };
    }
    /**
     * Calcula las EMAs (Exponential Moving Averages)
     */
    calculateEMAs(prices) {
        return {
            ema9: this.calculateEMA(prices, 9),
            ema21: this.calculateEMA(prices, 21),
            ema50: this.calculateEMA(prices, 50)
        };
    }
    /**
     * Calcula una EMA específica
     */
    calculateEMA(prices, period) {
        if (prices.length === 0)
            return 0;
        if (prices.length === 1)
            return prices[0];
        const multiplier = 2 / (period + 1);
        let ema = prices[0];
        for (let i = 1; i < prices.length; i++) {
            ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
        }
        return ema;
    }
    /**
     * Analiza el volumen
     */
    analyzeVolume(volumes) {
        if (volumes.length === 0)
            return { avg: 0, current: 0, ratio: 1 };
        const avg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const current = volumes[volumes.length - 1];
        const ratio = current / avg;
        return { avg, current, ratio };
    }
    /**
     * Genera señales de trading basadas en los indicadores
     */
    generateSignals(indicators) {
        const signals = {
            buy: false,
            sell: false,
            strength: 0,
            reasoning: []
        };
        // Análisis RSI
        if (indicators.rsi < 30) {
            signals.buy = true;
            signals.strength += 0.3;
            signals.reasoning.push(`RSI oversold: ${indicators.rsi.toFixed(2)}`);
        }
        else if (indicators.rsi > 70) {
            signals.sell = true;
            signals.strength += 0.3;
            signals.reasoning.push(`RSI overbought: ${indicators.rsi.toFixed(2)}`);
        }
        // Análisis MACD
        if (indicators.macd.macd > indicators.macd.signal && indicators.macd.histogram > 0) {
            signals.buy = true;
            signals.strength += 0.2;
            signals.reasoning.push('MACD bullish crossover');
        }
        else if (indicators.macd.macd < indicators.macd.signal && indicators.macd.histogram < 0) {
            signals.sell = true;
            signals.strength += 0.2;
            signals.reasoning.push('MACD bearish crossover');
        }
        // Análisis Bollinger Bands
        const currentPrice = indicators.bollinger.middle;
        if (currentPrice <= indicators.bollinger.lower) {
            signals.buy = true;
            signals.strength += 0.2;
            signals.reasoning.push('Price at lower Bollinger Band');
        }
        else if (currentPrice >= indicators.bollinger.upper) {
            signals.sell = true;
            signals.strength += 0.2;
            signals.reasoning.push('Price at upper Bollinger Band');
        }
        // Análisis EMA
        if (indicators.ema.ema9 > indicators.ema.ema21 && indicators.ema.ema21 > indicators.ema.ema50) {
            signals.buy = true;
            signals.strength += 0.15;
            signals.reasoning.push('EMA bullish alignment');
        }
        else if (indicators.ema.ema9 < indicators.ema.ema21 && indicators.ema.ema21 < indicators.ema.ema50) {
            signals.sell = true;
            signals.strength += 0.15;
            signals.reasoning.push('EMA bearish alignment');
        }
        // Análisis de volumen
        if (indicators.volume.ratio > 1.5) {
            signals.strength += 0.1;
            signals.reasoning.push(`High volume: ${indicators.volume.ratio.toFixed(2)}x average`);
        }
        return {
            buy: signals.buy,
            sell: signals.sell,
            strength: Math.min(1, signals.strength),
            reasoning: signals.reasoning
        };
    }
    /**
     * Calcula el soporte y resistencia
     */
    calculateSupportResistance(klines) {
        if (klines.length < 20) {
            const lastPrice = klines[klines.length - 1].close;
            return { support: lastPrice, resistance: lastPrice, strength: 0 };
        }
        const highs = klines.map(k => k.high);
        const lows = klines.map(k => k.low);
        // Encontrar picos y valles
        const peaks = this.findPeaks(highs, 5);
        const valleys = this.findValleys(lows, 5);
        const resistance = peaks.length > 0 ? Math.max(...peaks) : Math.max(...highs);
        const support = valleys.length > 0 ? Math.min(...valleys) : Math.min(...lows);
        // Calcular fuerza basada en el número de toques
        const strength = Math.min(1, (peaks.length + valleys.length) / 10);
        return { support, resistance, strength };
    }
    /**
     * Encuentra picos en una serie de datos
     */
    findPeaks(data, window) {
        const peaks = [];
        for (let i = window; i < data.length - window; i++) {
            let isPeak = true;
            const current = data[i];
            for (let j = i - window; j <= i + window; j++) {
                if (j !== i && data[j] >= current) {
                    isPeak = false;
                    break;
                }
            }
            if (isPeak) {
                peaks.push(current);
            }
        }
        return peaks;
    }
    /**
     * Encuentra valles en una serie de datos
     */
    findValleys(data, window) {
        const valleys = [];
        for (let i = window; i < data.length - window; i++) {
            let isValley = true;
            const current = data[i];
            for (let j = i - window; j <= i + window; j++) {
                if (j !== i && data[j] <= current) {
                    isValley = false;
                    break;
                }
            }
            if (isValley) {
                valleys.push(current);
            }
        }
        return valleys;
    }
    /**
     * Calcula la volatilidad histórica
     */
    calculateVolatility(klines, period = 20) {
        if (klines.length < period + 1)
            return 0;
        const prices = klines.map(k => k.close);
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
        }
        const recentReturns = returns.slice(-period);
        const mean = recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;
        const variance = recentReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / recentReturns.length;
        return Math.sqrt(variance) * Math.sqrt(365 * 24 * 12); // Anualizada para 5min
    }
}
exports.TechnicalAnalysis = TechnicalAnalysis;
//# sourceMappingURL=technical-analysis.js.map