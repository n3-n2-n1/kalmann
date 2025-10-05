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
    /**
     * Detecta patrones de velas en corto plazo (para scalping)
     */
    detectCandlePatterns(klines) {
        if (klines.length < 10) {
            return { patterns: [], lastCandles: [] };
        }
        const patterns = [];
        const recentCandles = klines.slice(-10);
        const last3 = klines.slice(-3);
        // Analizar últimas velas
        const lastCandles = recentCandles.map(k => ({
            color: k.close > k.open ? 'green' : 'red',
            bodySize: Math.abs(k.close - k.open) / k.open,
            volume: k.volume,
            timestamp: k.openTime
        }));
        // Patrón: 3 Velas Rojas Consecutivas (THREE_RED_SOLDIERS)
        if (last3.every(k => k.close < k.open)) {
            const avgBodySize = last3.reduce((sum, k) => sum + Math.abs(k.close - k.open), 0) / 3;
            patterns.push({
                type: 'THREE_RED_SOLDIERS',
                confidence: 0.75,
                suggests: 'SHORT',
                reason: `3 velas rojas consecutivas con tamaño promedio ${(avgBodySize / last3[0].open * 100).toFixed(2)}%`
            });
        }
        // Patrón: 3 Velas Verdes Consecutivas (THREE_GREEN_SOLDIERS)
        if (last3.every(k => k.close > k.open)) {
            const avgBodySize = last3.reduce((sum, k) => sum + Math.abs(k.close - k.open), 0) / 3;
            patterns.push({
                type: 'THREE_GREEN_SOLDIERS',
                confidence: 0.75,
                suggests: 'LONG',
                reason: `3 velas verdes consecutivas con tamaño promedio ${(avgBodySize / last3[0].open * 100).toFixed(2)}%`
            });
        }
        // Patrón: Momentum Decreciente (velas cada vez más pequeñas)
        const bodySizes = last3.map(k => Math.abs(k.close - k.open));
        const isDecreasing = bodySizes[0] > bodySizes[1] && bodySizes[1] > bodySizes[2];
        if (isDecreasing) {
            patterns.push({
                type: 'MOMENTUM_WEAKENING',
                confidence: 0.6,
                suggests: 'CLOSE_POSITION',
                reason: 'Momentum decreciente: velas cada vez más pequeñas'
            });
        }
        // Patrón: Volume Spike (volumen 3x promedio)
        const avgVolume = recentCandles.slice(0, -1).reduce((sum, k) => sum + k.volume, 0) / (recentCandles.length - 1);
        const lastVolume = recentCandles[recentCandles.length - 1].volume;
        if (lastVolume > avgVolume * 3) {
            patterns.push({
                type: 'VOLUME_SPIKE',
                confidence: 0.8,
                suggests: 'REVERSAL_INCOMING',
                reason: `Volumen ${(lastVolume / avgVolume).toFixed(1)}x el promedio - posible reversión`
            });
        }
        // Patrón: Doji (indecisión)
        const lastCandle = last3[last3.length - 1];
        const bodyPercent = Math.abs(lastCandle.close - lastCandle.open) / (lastCandle.high - lastCandle.low);
        if (bodyPercent < 0.1) {
            patterns.push({
                type: 'DOJI',
                confidence: 0.65,
                suggests: 'WAIT',
                reason: 'Doji detectado - indecisión del mercado'
            });
        }
        return { patterns, lastCandles };
    }
    /**
     * Analiza Order Book para detectar presión de compra/venta y walls
     */
    analyzeOrderBook(orderBook) {
        const { bids, asks } = orderBook;
        // Calcular liquidez total
        const totalBidLiquidity = bids.reduce((sum, bid) => sum + bid.quantity, 0);
        const totalAskLiquidity = asks.reduce((sum, ask) => sum + ask.quantity, 0);
        // Imbalance (> 1 = más compradores, < 1 = más vendedores)
        const bidAskImbalance = totalBidLiquidity / (totalAskLiquidity || 1);
        // Spread
        const bestBid = bids[0]?.price || 0;
        const bestAsk = asks[0]?.price || 0;
        const spread = bestAsk - bestBid;
        const spreadPercent = (spread / bestBid) * 100;
        // Detectar "walls" (órdenes grandes que actúan como soporte/resistencia)
        const avgBidQty = totalBidLiquidity / bids.length;
        const avgAskQty = totalAskLiquidity / asks.length;
        const bidWalls = bids.filter(bid => bid.quantity > avgBidQty * 3).slice(0, 5);
        const askWalls = asks.filter(ask => ask.quantity > avgAskQty * 3).slice(0, 5);
        // Determinar presión del mercado
        let pressure;
        let confidence;
        if (bidAskImbalance > 1.5) {
            pressure = 'BULLISH';
            confidence = Math.min((bidAskImbalance - 1) / 2, 0.9);
        }
        else if (bidAskImbalance < 0.67) {
            pressure = 'BEARISH';
            confidence = Math.min((1 - bidAskImbalance) / 0.5, 0.9);
        }
        else {
            pressure = 'NEUTRAL';
            confidence = 0.5;
        }
        return {
            bidAskImbalance,
            spread,
            spreadPercent,
            bidWalls,
            askWalls,
            totalBidLiquidity,
            totalAskLiquidity,
            pressure,
            confidence
        };
    }
    /**
     * Compara tendencia en diferentes timeframes para detectar divergencias
     */
    compareTrends(klines1m, klines5m) {
        // Tendencia macro (5m) - últimas 20 velas
        const macro5m = klines5m.slice(-20);
        const macroChange = (macro5m[macro5m.length - 1].close - macro5m[0].close) / macro5m[0].close;
        const macroTrend = macroChange > 0.002 ? 'bullish' : macroChange < -0.002 ? 'bearish' : 'neutral';
        // Tendencia micro (1m) - últimas 10 velas
        const micro1m = klines1m.slice(-10);
        const microChange = (micro1m[micro1m.length - 1].close - micro1m[0].close) / micro1m[0].close;
        const microTrend = microChange > 0.001 ? 'bullish' : microChange < -0.001 ? 'bearish' : 'neutral';
        // Detectar divergencia (oportunidad de scalping)
        const divergence = (macroTrend === 'bullish' && microTrend === 'bearish') ||
            (macroTrend === 'bearish' && microTrend === 'bullish');
        let suggestedAction = 'HOLD';
        let confidence = 0.5;
        if (divergence) {
            if (macroTrend === 'bullish' && microTrend === 'bearish') {
                suggestedAction = 'SHORT_QUICK'; // Corrección temporal en tendencia alcista
                confidence = 0.7;
            }
            else if (macroTrend === 'bearish' && microTrend === 'bullish') {
                suggestedAction = 'LONG_QUICK'; // Rebote temporal en tendencia bajista
                confidence = 0.7;
            }
        }
        else {
            // Sin divergencia, seguir la tendencia
            if (macroTrend === 'bullish' && microTrend === 'bullish') {
                suggestedAction = 'LONG';
                confidence = 0.8;
            }
            else if (macroTrend === 'bearish' && microTrend === 'bearish') {
                suggestedAction = 'SHORT';
                confidence = 0.8;
            }
        }
        return {
            microTrend,
            macroTrend,
            divergence,
            suggestedAction,
            confidence
        };
    }
}
exports.TechnicalAnalysis = TechnicalAnalysis;
//# sourceMappingURL=technical-analysis.js.map