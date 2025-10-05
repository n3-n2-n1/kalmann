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
     * Obtiene el Order Book (libro de órdenes) para análisis de liquidez y presión compra/venta
     */
    getOrderBook(symbol: string, depth?: number): Promise<{
        bids: Array<{
            price: number;
            quantity: number;
        }>;
        asks: Array<{
            price: number;
            quantity: number;
        }>;
        timestamp: number;
    }>;
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
     * Actualiza el Stop Loss de una posición existente (para trailing stop)
     */
    updatePositionStopLoss(symbol: string, stopLoss: number, takeProfit?: number): Promise<void>;
    /**
     * Obtiene el historial de órdenes ejecutadas
     */
    getOrderHistory(symbol: string, limit?: number): Promise<any[]>;
    /**
     * Verifica si hubo ejecuciones de TP/SL en las últimas órdenes
     */
    checkTPSLExecutions(symbol: string, lastCheckTime: number): Promise<{
        tpExecuted: boolean;
        slExecuted: boolean;
        orders: any[];
    }>;
    /**
     * Cierra una posición específica (completa o parcial)
     */
    closePosition(symbol: string, side: 'Buy' | 'Sell', percentage?: number): Promise<TradeResult>;
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
    /**
     * Limpia errores de precisión de punto flotante
     * Convierte 0.40700000000000003 -> "0.407"
     */
    private cleanFloatPrecision;
}
//# sourceMappingURL=bybit-client.d.ts.map