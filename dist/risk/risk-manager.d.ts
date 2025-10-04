import { Position, TradingConfig } from '../types';
/**
 * Sistema de gestión de riesgo inteligente
 * Protege el capital y optimiza la exposición al riesgo
 */
export declare class RiskManager {
    private logger;
    private bybit;
    private config;
    private dailyTrades;
    private lastResetDate;
    constructor();
    /**
     * Valida si un trade es seguro para ejecutar
     */
    validateTrade(tradeParams: {
        symbol: string;
        side: 'Buy' | 'Sell';
        quantity: number;
        leverage?: number;
        stopLoss?: number;
        takeProfit?: number;
    }): Promise<{
        approved: boolean;
        reason: string;
        adjustedParams?: any;
        riskScore: number;
    }>;
    /**
     * Calcula el score de riesgo de un trade
     */
    private calculateRiskScore;
    /**
     * Valida el stop loss
     */
    private validateStopLoss;
    /**
     * Calcula la exposición total de las posiciones
     */
    private calculateTotalExposure;
    /**
     * Calcula el riesgo de volatilidad
     */
    private calculateVolatilityRisk;
    /**
     * Obtiene el precio actual de un símbolo
     */
    private getCurrentPrice;
    /**
     * Resetea el contador diario si es necesario
     */
    private resetDailyCounterIfNeeded;
    /**
     * Incrementa el contador de trades
     */
    incrementTradeCounter(): void;
    /**
     * Calcula el tamaño de posición óptimo
     */
    calculateOptimalPositionSize(accountBalance: number, riskPercentage: number, entryPrice: number, stopLossPrice: number): number;
    /**
     * Calcula el take profit basado en el stop loss
     */
    calculateTakeProfit(entryPrice: number, stopLossPrice: number, riskRewardRatio?: number): number;
    /**
     * Monitorea posiciones abiertas y sugiere acciones
     */
    monitorPositions(): Promise<{
        positions: Position[];
        alerts: string[];
        suggestedActions: string[];
    }>;
    /**
     * Actualiza la configuración de riesgo
     */
    updateConfig(newConfig: Partial<TradingConfig>): void;
    /**
     * Obtiene estadísticas de riesgo
     */
    getRiskStats(): {
        dailyTrades: number;
        maxDailyTrades: number;
        riskPercentage: number;
        maxLeverage: number;
        maxPositionSize: number;
    };
}
//# sourceMappingURL=risk-manager.d.ts.map