/**
 * Punto de entrada principal del sistema de trading automatizado
 */
declare class TradingSystem {
    private logger;
    private mcpServer;
    private tradingStrategy;
    private isRunning;
    constructor();
    /**
     * Inicia el sistema completo
     */
    start(): Promise<void>;
    /**
     * Detiene el sistema
     */
    stop(): Promise<void>;
    /**
     * Valida las variables de entorno requeridas
     */
    private validateEnvironment;
    /**
     * Configura el cierre graceful del sistema
     */
    private setupGracefulShutdown;
    /**
     * Obtiene el estado del sistema
     */
    getStatus(): {
        isRunning: boolean;
        mcpPort: number;
        autoTrading: boolean;
        tradingSymbol?: string;
    };
}
declare const tradingSystem: TradingSystem;
export { TradingSystem };
export default tradingSystem;
//# sourceMappingURL=index.d.ts.map