import { AIAnalysis } from '../types';
/**
 * Cliente para interactuar con Ollama y obtener análisis de IA
 */
export declare class OllamaClient {
    private client;
    private logger;
    private config;
    constructor();
    /**
     * Analiza datos de mercado y devuelve decisión de trading
     */
    analyze(prompt: string): Promise<AIAnalysis>;
    /**
     * Genera un análisis de sentimiento del mercado
     */
    analyzeSentiment(marketNews: string[], priceAction: string): Promise<{
        sentiment: 'bullish' | 'bearish' | 'neutral';
        confidence: number;
        factors: string[];
    }>;
    /**
     * Genera estrategia de trading personalizada
     */
    generateStrategy(symbol: string, timeframe: string, riskTolerance: 'low' | 'medium' | 'high', marketCondition: string): Promise<{
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
        side: 'Buy' | 'Sell';
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
}
//# sourceMappingURL=ollama-client.d.ts.map