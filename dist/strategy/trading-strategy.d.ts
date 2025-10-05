/**
 * Estrategia de trading automatizada con IA
 * Combina análisis técnico, predicción Kalman y decisiones de IA
 */
export declare class TradingStrategy {
    private logger;
    private ollama;
    private technical;
    private kalman;
    private riskManager;
    private bybit;
    private dataManager;
    private redisHistory;
    private isRunning;
    private positionTracking;
    constructor();
    /**
     * Inicia la estrategia de trading
     */
    start(symbol: string, interval?: string): Promise<void>;
    /**
     * Detiene la estrategia de trading
     */
    stop(): Promise<void>;
    /**
     * Loop principal de trading
     */
    private tradingLoop;
    /**
     * Realiza análisis completo del mercado
     */
    private performCompleteAnalysis;
    /**
     * Genera señal de trading basada en el análisis
     */
    private generateTradingSignal;
    /**
     * Ejecuta una acción de trading
     */
    private executeTradingAction;
    /**
     * Gestiona posiciones existentes: trailing stop y estrategias de salida
     */
    private manageExistingPositions;
    /**
     * Actualiza el trailing stop de una posición
     */
    private updateTrailingStop;
    /**
     * Evalúa todas las estrategias de salida y retorna recomendación
     */
    private evaluateExitStrategies;
    /**
     * Ejecuta la acción de salida recomendada
     */
    private executeExitAction;
    /**
     * Calcula el leverage óptimo - AJUSTADO PARA SCALPING (MÁS CONSERVADOR)
     */
    private calculateOptimalLeverage;
    /**
     * Calcula el tamaño de posición - OPTIMIZADO PARA APALANCAMIENTO ALTO
     */
    private calculatePositionSize;
    /**
     * Calcula el stop loss - AJUSTADO PARA SCALPING
     */
    private calculateStopLoss;
    /**
     * Calcula el take profit - AJUSTADO PARA SCALPING
     */
    private calculateTakeProfit;
    /**
     * Construye el prompt para IA - OPTIMIZADO PARA TRADING AGRESIVO
     */
    private buildAIPrompt;
    /**
     * Verifica la salud del sistema
     */
    private healthCheck;
    /**
     * Convierte intervalo a milisegundos
     */
    private getIntervalMs;
    /**
     * Espera a que se recopilen suficientes datos
     */
    private waitForData;
    /**
     * Función de sleep
     */
    private sleep;
}
//# sourceMappingURL=trading-strategy.d.ts.map