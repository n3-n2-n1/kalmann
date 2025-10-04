import { MarketData, Kline, Position, TradeResult } from '../types';
/**
 * Cliente para interactuar con la API de Bybit
 * Soporta trading de perpetuos con análisis en tiempo real
 */
export declare class BybitClient {
    private client;
    private logger;
    private config;
    constructor();
    /**
     * Obtiene datos de mercado en tiempo real
     */
    getMarketData(symbol: string, _interval?: string): Promise<MarketData>;
    /**
     * Obtiene velas (klines) históricas
     */
    getKlines(symbol: string, interval: string, limit?: number): Promise<Kline[]>;
    /**
     * Ejecuta una orden de trading
     */
    executeTrade(params: {
        symbol: string;
        side: 'Buy' | 'Sell';
        quantity: number;
        leverage?: number;
        stopLoss?: number;
        takeProfit?: number;
    }): Promise<TradeResult>;
    /**
     * Obtiene posiciones activas
     */
    getPositions(symbol?: string): Promise<Position[]>;
    /**
     * Establece el leverage para un símbolo
     */
    setLeverage(symbol: string, leverage: number): Promise<void>;
    /**
     * Obtiene el balance de la cuenta
     */
    getBalance(): Promise<{
        totalBalance: number;
        availableBalance: number;
        usedMargin: number;
    }>;
    /**
     * Cierra una posición específica
     */
    closePosition(symbol: string, side: 'Buy' | 'Sell'): Promise<TradeResult>;
    /**
     * Realiza una petición autenticada a la API
     */
    private makeAuthenticatedRequest;
    /**
     * Convierte intervalo de string a milisegundos
     */
    private getIntervalMs;
    /**
     * Verifica la conexión con Bybit
     */
    healthCheck(): Promise<boolean>;
    /**
     * Obtiene información del símbolo
     */
    getSymbolInfo(symbol: string): Promise<{
        symbol: string;
        baseCoin: string;
        quoteCoin: string;
        minOrderQty: number;
        maxOrderQty: number;
        tickSize: number;
        stepSize: number;
    }>;
    /**
     * Convierte intervalo a formato de Bybit
     */
    private convertInterval;
}
//# sourceMappingURL=bybit-client.d.ts.map