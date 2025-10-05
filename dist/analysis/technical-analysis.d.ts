import { Kline, TechnicalIndicators } from '../types';
/**
 * Análisis técnico avanzado con múltiples indicadores
 * Proporciona señales de trading basadas en indicadores técnicos
 */
export declare class TechnicalAnalysis {
    private logger;
    constructor();
    /**
     * Realiza análisis técnico completo
     */
    analyze(klines: Kline[], period?: number): Promise<TechnicalIndicators>;
    /**
     * Calcula el RSI (Relative Strength Index)
     */
    private calculateRSI;
    /**
     * Calcula el MACD (Moving Average Convergence Divergence)
     */
    private calculateMACD;
    /**
     * Calcula las Bandas de Bollinger
     */
    private calculateBollingerBands;
    /**
     * Calcula las EMAs (Exponential Moving Averages)
     */
    private calculateEMAs;
    /**
     * Calcula una EMA específica
     */
    private calculateEMA;
    /**
     * Analiza el volumen
     */
    private analyzeVolume;
    /**
     * Genera señales de trading basadas en los indicadores
     */
    generateSignals(indicators: TechnicalIndicators): {
        buy: boolean;
        sell: boolean;
        strength: number;
        reasoning: string[];
    };
    /**
     * Calcula el soporte y resistencia
     */
    calculateSupportResistance(klines: Kline[]): {
        support: number;
        resistance: number;
        strength: number;
    };
    /**
     * Encuentra picos en una serie de datos
     */
    private findPeaks;
    /**
     * Encuentra valles en una serie de datos
     */
    private findValleys;
    /**
     * Calcula la volatilidad histórica
     */
    calculateVolatility(klines: Kline[], period?: number): number;
    /**
     * Detecta patrones de velas en corto plazo (para scalping)
     */
    detectCandlePatterns(klines: Kline[]): {
        patterns: Array<{
            type: string;
            confidence: number;
            suggests: string;
            reason: string;
        }>;
        lastCandles: Array<{
            color: string;
            bodySize: number;
            volume: number;
            timestamp: number;
        }>;
    };
    /**
     * Analiza Order Book para detectar presión de compra/venta y walls
     */
    analyzeOrderBook(orderBook: {
        bids: Array<{
            price: number;
            quantity: number;
        }>;
        asks: Array<{
            price: number;
            quantity: number;
        }>;
    }): {
        bidAskImbalance: number;
        spread: number;
        spreadPercent: number;
        bidWalls: Array<{
            price: number;
            quantity: number;
        }>;
        askWalls: Array<{
            price: number;
            quantity: number;
        }>;
        totalBidLiquidity: number;
        totalAskLiquidity: number;
        pressure: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
        confidence: number;
    };
    /**
     * Compara tendencia en diferentes timeframes para detectar divergencias
     */
    compareTrends(klines1m: Kline[], klines5m: Kline[]): {
        microTrend: 'bullish' | 'bearish' | 'neutral';
        macroTrend: 'bullish' | 'bearish' | 'neutral';
        divergence: boolean;
        suggestedAction: string;
        confidence: number;
    };
}
//# sourceMappingURL=technical-analysis.d.ts.map