import { Kline } from '../types';
/**
 * Gestor de datos para recopilar y almacenar velas históricas
 * Mantiene un buffer de datos para análisis técnico y Kalman
 */
export declare class DataManager {
    private logger;
    private bybit;
    private dataBuffer;
    private isCollecting;
    private collectionInterval;
    constructor();
    /**
     * Inicia la recopilación de datos para un símbolo
     */
    startDataCollection(symbol: string, interval?: string): Promise<void>;
    /**
     * Recopila datos históricos iniciales
     */
    private collectHistoricalData;
    /**
     * Inicia recopilación en tiempo real
     */
    private startRealTimeCollection;
    /**
     * Actualiza los datos más recientes
     */
    private updateLatestData;
    /**
     * Obtiene velas para análisis
     */
    getKlines(symbol: string, limit?: number): Kline[];
    /**
     * Obtiene las últimas N velas
     */
    getLatestKlines(symbol: string, count?: number): Kline[];
    /**
     * Verifica si hay suficientes datos
     */
    hasEnoughData(symbol: string, minRequired?: number): boolean;
    /**
     * Obtiene estadísticas del buffer
     */
    getBufferStats(symbol: string): {
        totalKlines: number;
        latestPrice: number;
        oldestPrice: number;
        priceChange: number;
        timeRange: {
            start: number;
            end: number;
        };
    };
    /**
     * Detiene la recopilación de datos
     */
    stopDataCollection(): void;
    /**
     * Limpia el buffer de datos
     */
    clearBuffer(symbol?: string): void;
    /**
     * Obtiene el estado de recopilación
     */
    getCollectionStatus(): {
        isCollecting: boolean;
        symbols: string[];
        bufferSizes: {
            [symbol: string]: number;
        };
    };
    /**
     * Convierte intervalo a milisegundos
     */
    private getIntervalMs;
}
//# sourceMappingURL=data-manager.d.ts.map