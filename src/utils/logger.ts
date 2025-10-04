import * as winston from 'winston';
import { LogEntry } from '../types';

/**
 * Sistema de logging centralizado con Winston
 * Proporciona logging estructurado para todo el sistema
 */
export class Logger {
  private winston: winston.Logger;
  private module: string;

  constructor(module: string) {
    this.module = module;
    this.winston = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { module },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ]
    });
  }

  /**
   * Log de información
   */
  info(message: string, data?: any): void {
    this.winston.info(message, data);
  }

  /**
   * Log de debug
   */
  debug(message: string, data?: any): void {
    this.winston.debug(message, data);
  }

  /**
   * Log de advertencia
   */
  warn(message: string, data?: any): void {
    this.winston.warn(message, data);
  }

  /**
   * Log de error
   */
  error(message: string, error?: any): void {
    this.winston.error(message, { error: error?.stack || error });
  }

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
  }): void {
    this.winston.info(`TRADE_${action.toUpperCase()}`, {
      ...data,
      timestamp: data.timestamp || Date.now()
    });
  }

  /**
   * Log de análisis de IA
   */
  aiAnalysis(data: {
    symbol: string;
    decision: string;
    confidence: number;
    reasoning: string;
    indicators?: any;
  }): void {
    this.winston.info('AI_ANALYSIS', {
      ...data,
      timestamp: Date.now()
    });
  }

  /**
   * Log de riesgo
   */
  risk(level: 'low' | 'medium' | 'high', message: string, data?: any): void {
    this.winston.warn(`RISK_${level.toUpperCase()}: ${message}`, data);
  }

  /**
   * Log de sistema
   */
  system(component: string, status: 'start' | 'stop' | 'error', data?: any): void {
    this.winston.info(`SYSTEM_${component.toUpperCase()}_${status.toUpperCase()}`, {
      component,
      status,
      ...data,
      timestamp: Date.now()
    });
  }

  /**
   * Log de métricas
   */
  metrics(metrics: {
    name: string;
    value: number;
    unit?: string;
    tags?: { [key: string]: string };
  }): void {
    this.winston.info('METRICS', {
      ...metrics,
      timestamp: Date.now()
    });
  }

  /**
   * Crea un log entry estructurado
   */
  createLogEntry(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any): LogEntry {
    return {
      level,
      message,
      timestamp: Date.now(),
      module: this.module,
      data
    };
  }

  /**
   * Obtiene logs recientes
   */
  async getRecentLogs(_limit: number = 100): Promise<LogEntry[]> {
    // Esta implementación sería más compleja en producción
    // Por ahora retornamos un array vacío
    return [];
  }

  /**
   * Limpia logs antiguos
   */
  async cleanOldLogs(daysToKeep: number = 7): Promise<void> {
    this.winston.info(`Limpiando logs más antiguos que ${daysToKeep} días`);
    // Implementación de limpieza de logs
  }
}