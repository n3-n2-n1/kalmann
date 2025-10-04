import { LogEntry } from '../types';
/**
 * Sistema de logging centralizado con Winston
 * Proporciona logging estructurado para todo el sistema
 */
export declare class Logger {
    private winston;
    private module;
    constructor(module: string);
    /**
     * Log de información
     */
    info(message: string, data?: any): void;
    /**
     * Log de debug
     */
    debug(message: string, data?: any): void;
    /**
     * Log de advertencia
     */
    warn(message: string, data?: any): void;
    /**
     * Log de error
     */
    error(message: string, error?: any): void;
    /**
     * Log estructurado para trading
     */
    trade(action: string, data: {
        symbol: string;
        side?: string;
        quantity?: number;
        price?: number;
        pnl?: number;
        timestamp?: number;
    }): void;
    /**
     * Log de análisis de IA
     */
    aiAnalysis(data: {
        symbol: string;
        decision: string;
        confidence: number;
        reasoning: string;
        indicators?: any;
    }): void;
    /**
     * Log de riesgo
     */
    risk(level: 'low' | 'medium' | 'high', message: string, data?: any): void;
    /**
     * Log de sistema
     */
    system(component: string, status: 'start' | 'stop' | 'error', data?: any): void;
    /**
     * Log de métricas
     */
    metrics(metrics: {
        name: string;
        value: number;
        unit?: string;
        tags?: {
            [key: string]: string;
        };
    }): void;
    /**
     * Crea un log entry estructurado
     */
    createLogEntry(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any): LogEntry;
    /**
     * Obtiene logs recientes
     */
    getRecentLogs(_limit?: number): Promise<LogEntry[]>;
    /**
     * Limpia logs antiguos
     */
    cleanOldLogs(daysToKeep?: number): Promise<void>;
}
//# sourceMappingURL=logger.d.ts.map