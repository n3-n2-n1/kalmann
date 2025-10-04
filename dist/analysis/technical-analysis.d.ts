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
}
//# sourceMappingURL=technical-analysis.d.ts.map