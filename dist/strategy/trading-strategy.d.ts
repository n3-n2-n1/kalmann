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
    private isRunning;
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
     * Analiza posición existente y decide si cerrar
     */
    private analyzeExistingPosition;
    /**
     * Determina si debe cerrar una posición existente
     */
    private shouldClosePosition;
    /**
     * Ejecuta una acción de trading
     */
    private executeTradingAction;
    /**
     * Calcula el leverage óptimo - OPTIMIZADO PARA APALANCAMIENTO ALTO
     */
    private calculateOptimalLeverage;
    /**
     * Calcula el tamaño de posición - OPTIMIZADO PARA APALANCAMIENTO ALTO
     */
    private calculatePositionSize;
    /**
     * Calcula el stop loss
     */
    private calculateStopLoss;
    /**
     * Calcula el take profit
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