import { AIAnalysis } from "../types";
/**
 * Cliente para interactuar con Ollama y obtener análisis de IA
 * Soporta análisis directo y function calling (si el modelo lo soporta)
 */
export declare class OllamaClient {
    private client;
    private logger;
    private config;
    private supportsTools;
    constructor();
    /**
     * Detecta si Ollama/modelo soporta function calling
     */
    private detectToolsSupport;
    /**
     * Analiza datos de mercado y devuelve decisión de trading
     * Usa el prompt optimizado que ya incluye TODOS los datos necesarios
     */
    analyze(prompt: string): Promise<AIAnalysis>;
    /**
     * Obtiene información del modelo actual
     */
    getModelInfo(): Promise<{
        name: string;
        size: string;
        supportsTools: boolean;
    }>;
    /**
     * Genera un análisis de sentimiento del mercado
     */
    analyzeSentiment(priceAction: string): Promise<{
        sentiment: "bullish" | "bearish" | "neutral";
        confidence: number;
        factors: string[];
    }>;
    /**
     * Genera estrategia de trading personalizada
     */
    generateStrategy(symbol: string, timeframe: string, riskTolerance: "low" | "medium" | "high", marketCondition: string): Promise<{
        strategy: string;
        entryRules: string[];
        exitRules: string[];
        riskManagement: string[];
        expectedReturn: number;
    }>;
    /**
     * Evalúa el riesgo de una operación específica
     */
    evaluateTradeRisk(tradeParams: {
        symbol: string;
        side: "Buy" | "Sell";
        leverage: number;
        quantity: number;
        currentPrice: number;
    }, marketContext: any): Promise<{
        riskScore: number;
        riskFactors: string[];
        recommendations: string[];
        approved: boolean;
    }>;
    /**
     * Analiza una posición existente y decide si mantener, cerrar parcial o cerrar completa
     */
    analyzePosition(position: any, marketData: any, technical: any, kalman: any, timeInPosition: number): Promise<{
        action: "HOLD" | "CLOSE_25" | "CLOSE_50" | "CLOSE_100";
        confidence: number;
        reasoning: string;
        riskLevel: string;
    }>;
    /**
     * Verifica si Ollama está disponible
     */
    healthCheck(): Promise<boolean>;
    /**
     * Parsea la respuesta de IA y extrae el JSON
     */
    private parseAIResponse;
    /**
     * Extrae JSON de una cadena de texto
     */
    private extractJSON;
    /**
     * Parser de fallback cuando no se puede extraer JSON
     */
    private fallbackParser;
    /**
     * Valida y limpia el análisis de IA
     */
    private validateAndCleanAnalysis;
    /**
     * Reinicia el cliente (útil para reconexión)
     */
    reconnect(): Promise<void>;
    /**
     * Obtiene estadísticas de uso
     */
    getStats(): {
        host: string;
        model: string;
        timeout: number;
        supportsTools: boolean;
    };
}
//# sourceMappingURL=ollama-client.d.ts.map