import { Kline } from '../types';
import { Logger } from '../utils/logger';
import { BybitClient } from '../exchange/bybit-client';

/**
 * Gestor de datos para recopilar y almacenar velas históricas
 * Mantiene un buffer de datos para análisis técnico y Kalman
 */
export class DataManager {
  private logger: Logger;
  private bybit: BybitClient;
  private dataBuffer: Map<string, Kline[]> = new Map();
  private isCollecting: boolean = false;
  private collectionInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.logger = new Logger('DataManager');
    this.bybit = new BybitClient();
  }

  /**
   * Inicia la recopilación de datos para un símbolo
   */
  async startDataCollection(symbol: string, interval: string = '5m'): Promise<void> {
    try {
      this.logger.info(`Iniciando recopilación de datos para ${symbol} (${interval})`);
      
      // Recopilar datos históricos iniciales
      await this.collectHistoricalData(symbol, interval);
      
      // Iniciar recopilación en tiempo real
      this.startRealTimeCollection(symbol, interval);
      
      this.isCollecting = true;
      this.logger.info(`Recopilación de datos iniciada para ${symbol}`);
      
    } catch (error) {
      this.logger.error('Error iniciando recopilación de datos:', error);
      throw error;
    }
  }

  /**
   * Recopila datos históricos iniciales
   */
  private async collectHistoricalData(symbol: string, interval: string): Promise<void> {
    try {
      this.logger.info(`Recopilando datos históricos para ${symbol}...`);
      
      // Recopilar 200 velas para tener suficiente data
      const klines = await this.bybit.getKlines(symbol, interval, 200);
      
      // Almacenar en buffer
      this.dataBuffer.set(symbol, klines);
      
      this.logger.info(`Datos históricos recopilados: ${klines.length} velas para ${symbol}`);
      
    } catch (error) {
      this.logger.error('Error recopilando datos históricos:', error);
      throw error;
    }
  }

  /**
   * Inicia recopilación en tiempo real
   */
  private startRealTimeCollection(symbol: string, interval: string): void {
    const intervalMs = this.getIntervalMs(interval);
    
    this.collectionInterval = setInterval(async () => {
      try {
        await this.updateLatestData(symbol, interval);
      } catch (error) {
        this.logger.error('Error en recopilación en tiempo real:', error);
      }
    }, intervalMs);
  }

  /**
   * Actualiza los datos más recientes
   */
  private async updateLatestData(symbol: string, interval: string): Promise<void> {
    try {
      // Obtener las últimas 5 velas para actualizar
      const latestKlines = await this.bybit.getKlines(symbol, interval, 5);
      const currentBuffer = this.dataBuffer.get(symbol) || [];
      
      // Actualizar buffer manteniendo solo las últimas 200 velas
      const updatedBuffer = [...currentBuffer, ...latestKlines]
        .slice(-200) // Mantener solo las últimas 200
        .filter((kline, index, array) => {
          // Eliminar duplicados por timestamp
          return index === 0 || kline.openTime !== array[index - 1].openTime;
        });
      
      this.dataBuffer.set(symbol, updatedBuffer);
      
      this.logger.debug(`Buffer actualizado para ${symbol}: ${updatedBuffer.length} velas`);
      
    } catch (error) {
      this.logger.error('Error actualizando datos:', error);
    }
  }

  /**
   * Obtiene velas para análisis
   */
  getKlines(symbol: string, limit: number = 100): Kline[] {
    const buffer = this.dataBuffer.get(symbol) || [];
    return buffer.slice(-limit);
  }

  /**
   * Obtiene las últimas N velas
   */
  getLatestKlines(symbol: string, count: number = 10): Kline[] {
    const buffer = this.dataBuffer.get(symbol) || [];
    return buffer.slice(-count);
  }

  /**
   * Verifica si hay suficientes datos
   */
  hasEnoughData(symbol: string, minRequired: number = 50): boolean {
    const buffer = this.dataBuffer.get(symbol) || [];
    return buffer.length >= minRequired;
  }

  /**
   * Obtiene estadísticas del buffer
   */
  getBufferStats(symbol: string): {
    totalKlines: number;
    latestPrice: number;
    oldestPrice: number;
    priceChange: number;
    timeRange: { start: number; end: number };
  } {
    const buffer = this.dataBuffer.get(symbol) || [];
    
    if (buffer.length === 0) {
      return {
        totalKlines: 0,
        latestPrice: 0,
        oldestPrice: 0,
        priceChange: 0,
        timeRange: { start: 0, end: 0 }
      };
    }
    
    const latest = buffer[buffer.length - 1];
    const oldest = buffer[0];
    
    return {
      totalKlines: buffer.length,
      latestPrice: latest.close,
      oldestPrice: oldest.close,
      priceChange: ((latest.close - oldest.close) / oldest.close) * 100,
      timeRange: { start: oldest.openTime, end: latest.closeTime }
    };
  }

  /**
   * Detiene la recopilación de datos
   */
  stopDataCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    this.isCollecting = false;
    this.logger.info('Recopilación de datos detenida');
  }

  /**
   * Limpia el buffer de datos
   */
  clearBuffer(symbol?: string): void {
    if (symbol) {
      this.dataBuffer.delete(symbol);
      this.logger.info(`Buffer limpiado para ${symbol}`);
    } else {
      this.dataBuffer.clear();
      this.logger.info('Todos los buffers limpiados');
    }
  }

  /**
   * Obtiene el estado de recopilación
   */
  getCollectionStatus(): {
    isCollecting: boolean;
    symbols: string[];
    bufferSizes: { [symbol: string]: number };
  } {
    const symbols = Array.from(this.dataBuffer.keys());
    const bufferSizes: { [symbol: string]: number } = {};
    
    symbols.forEach(symbol => {
      bufferSizes[symbol] = this.dataBuffer.get(symbol)?.length || 0;
    });
    
    return {
      isCollecting: this.isCollecting,
      symbols,
      bufferSizes
    };
  }

  /**
   * Convierte intervalo a milisegundos
   */
  private getIntervalMs(interval: string): number {
    const intervals: { [key: string]: number } = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000
    };
    return intervals[interval] || 5 * 60 * 1000;
  }
}
