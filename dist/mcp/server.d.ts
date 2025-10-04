/**
 * Servidor MCP principal que orquesta todo el sistema de trading
 */
export declare class MCPServer {
    private server;
    private wss;
    private logger;
    private ollama;
    private bybit;
    private kalman;
    private technical;
    private riskManager;
    private tools;
    private activeConnections;
    constructor(port?: number);
    /**
     * Configura los manejadores de WebSocket para comunicación MCP
     */
    private setupWebSocketHandlers;
    /**
     * Registra todas las herramientas MCP disponibles
     */
    private registerTools;
    /**
     * Registra una nueva herramienta MCP
     */
    private registerTool;
    /**
     * Maneja una solicitud MCP
     */
    private handleMCPRequest;
    /**
     * Construye el prompt para el análisis de IA
     */
    private buildAIPrompt;
    /**
     * Broadcast a todas las conexiones activas
     */
    broadcast(message: any): void;
    /**
     * Cierra el servidor
     */
    close(): Promise<void>;
}
//# sourceMappingURL=server.d.ts.map