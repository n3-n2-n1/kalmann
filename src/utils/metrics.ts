import { createServer, IncomingMessage, ServerResponse } from 'http';
import { Logger } from './logger';

/**
 * Sistema de métricas Prometheus para el bot de trading
 * Expone métricas en formato Prometheus en el puerto especificado
 */
export class MetricsCollector {
  private logger: Logger;
  private metrics: Map<string, any>;
  private server: any;
  private port: number;

  constructor(port: number = 9090) {
    this.logger = new Logger('MetricsCollector');
    this.metrics = new Map();
    this.port = port;
    
    this.initializeMetrics();
    this.startMetricsServer();
  }

  /**
   * Inicializa todas las métricas
   */
  private initializeMetrics(): void {
    // Métricas de trading
    this.metrics.set('trading_bot_pnl_total', { value: 0, type: 'gauge', help: 'PnL total en USDT' });
    this.metrics.set('trading_bot_pnl_realized', { value: 0, type: 'gauge', help: 'PnL realizado en USDT' });
    this.metrics.set('trading_bot_pnl_unrealized', { value: 0, type: 'gauge', help: 'PnL no realizado en USDT' });
    this.metrics.set('trading_bot_balance_available', { value: 0, type: 'gauge', help: 'Balance disponible en USDT' });
    this.metrics.set('trading_bot_balance_total', { value: 0, type: 'gauge', help: 'Balance total en USDT' });
    
    // Métricas de trades
    this.metrics.set('trading_bot_trades_total', { value: 0, type: 'counter', help: 'Total de trades ejecutados', labels: {} });
    this.metrics.set('trading_bot_trades_winning', { value: 0, type: 'counter', help: 'Total de trades ganadores' });
    this.metrics.set('trading_bot_trades_losing', { value: 0, type: 'counter', help: 'Total de trades perdedores' });
    this.metrics.set('trading_bot_win_rate', { value: 0, type: 'gauge', help: 'Win rate en porcentaje' });
    this.metrics.set('trading_bot_last_trade_timestamp', { value: 0, type: 'gauge', help: 'Timestamp del último trade' });
    
    // Métricas de posiciones
    this.metrics.set('trading_bot_positions_open', { value: 0, type: 'gauge', help: 'Número de posiciones abiertas' });
    this.metrics.set('trading_bot_position_pnl_percent', { value: 0, type: 'gauge', help: 'PnL de posición actual en porcentaje' });
    this.metrics.set('trading_bot_position_size', { value: 0, type: 'gauge', help: 'Tamaño de posición actual' });
    this.metrics.set('trading_bot_position_leverage', { value: 0, type: 'gauge', help: 'Leverage de posición actual' });
    
    // Métricas de IA
    this.metrics.set('trading_bot_ai_confidence', { value: 0, type: 'gauge', help: 'Confianza de IA en última decisión' });
    this.metrics.set('trading_bot_ai_decisions', { value: 0, type: 'counter', help: 'Total de decisiones de IA', labels: {} });
    this.metrics.set('trading_bot_kalman_confidence', { value: 0, type: 'gauge', help: 'Confianza de Kalman en predicción' });
    
    // Métricas de indicadores técnicos
    this.metrics.set('trading_bot_rsi', { value: 50, type: 'gauge', help: 'RSI actual' });
    this.metrics.set('trading_bot_macd_histogram', { value: 0, type: 'gauge', help: 'MACD Histogram' });
    this.metrics.set('trading_bot_macd_line', { value: 0, type: 'gauge', help: 'MACD Line' });
    this.metrics.set('trading_bot_macd_signal', { value: 0, type: 'gauge', help: 'MACD Signal Line' });
    
    // Métricas de salud del sistema
    this.metrics.set('trading_bot_ollama_health', { value: 0, type: 'gauge', help: 'Salud de Ollama (1=OK, 0=DOWN)' });
    this.metrics.set('trading_bot_bybit_health', { value: 0, type: 'gauge', help: 'Salud de Bybit API (1=OK, 0=DOWN)' });
    this.metrics.set('trading_bot_errors_total', { value: 0, type: 'counter', help: 'Total de errores', labels: {} });
    
    // Métricas de rendimiento
    this.metrics.set('trading_bot_analysis_duration_seconds', { value: 0, type: 'histogram', help: 'Duración del análisis en segundos' });
    this.metrics.set('trading_bot_trade_execution_duration_seconds', { value: 0, type: 'histogram', help: 'Duración de ejecución de trade en segundos' });

    this.logger.info(`${this.metrics.size} métricas inicializadas`);
  }

  /**
   * Inicia el servidor HTTP para exponer métricas
   */
  private startMetricsServer(): void {
    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.url === '/metrics') {
        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
        res.end(this.generatePrometheusMetrics());
      } else if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', timestamp: Date.now() }));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    this.server.listen(this.port, () => {
      this.logger.info(`Servidor de métricas iniciado en puerto ${this.port}`);
      this.logger.info(`Métricas disponibles en http://localhost:${this.port}/metrics`);
    });
  }

  /**
   * Genera el formato de métricas Prometheus
   */
  private generatePrometheusMetrics(): string {
    let output = '';

    this.metrics.forEach((metric, name) => {
      // HELP
      output += `# HELP ${name} ${metric.help}\n`;
      
      // TYPE
      output += `# TYPE ${name} ${metric.type}\n`;
      
      // VALUE
      if (metric.labels && Object.keys(metric.labels).length > 0) {
        // Métricas con labels
        for (const [labelKey, labelValue] of Object.entries(metric.labels)) {
          output += `${name}{${labelKey}="${labelValue}"} ${metric.value}\n`;
        }
      } else {
        // Métricas sin labels
        output += `${name} ${metric.value}\n`;
      }
      
      output += '\n';
    });

    return output;
  }

  /**
   * Actualiza una métrica gauge
   */
  setGauge(name: string, value: number): void {
    const metric = this.metrics.get(name);
    if (metric && metric.type === 'gauge') {
      metric.value = value;
    }
  }

  /**
   * Incrementa un counter
   */
  incrementCounter(name: string, labels?: { [key: string]: string }, amount: number = 1): void {
    const metric = this.metrics.get(name);
    if (metric && metric.type === 'counter') {
      if (labels) {
        // TODO: Implementar soporte para labels en counters
        metric.value += amount;
      } else {
        metric.value += amount;
      }
    }
  }

  /**
   * Observa un valor para histogram
   */
  observeHistogram(name: string, value: number): void {
    const metric = this.metrics.get(name);
    if (metric && metric.type === 'histogram') {
      // Implementación simple: guardar el último valor
      // En producción se debería guardar buckets
      metric.value = value;
    }
  }

  /**
   * Actualiza métricas de trading
   */
  updateTradingMetrics(data: {
    pnlTotal?: number;
    pnlRealized?: number;
    pnlUnrealized?: number;
    balanceAvailable?: number;
    balanceTotal?: number;
    positionsOpen?: number;
    positionPnlPercent?: number;
    positionSize?: number;
    positionLeverage?: number;
  }): void {
    if (data.pnlTotal !== undefined) this.setGauge('trading_bot_pnl_total', data.pnlTotal);
    if (data.pnlRealized !== undefined) this.setGauge('trading_bot_pnl_realized', data.pnlRealized);
    if (data.pnlUnrealized !== undefined) this.setGauge('trading_bot_pnl_unrealized', data.pnlUnrealized);
    if (data.balanceAvailable !== undefined) this.setGauge('trading_bot_balance_available', data.balanceAvailable);
    if (data.balanceTotal !== undefined) this.setGauge('trading_bot_balance_total', data.balanceTotal);
    if (data.positionsOpen !== undefined) this.setGauge('trading_bot_positions_open', data.positionsOpen);
    if (data.positionPnlPercent !== undefined) this.setGauge('trading_bot_position_pnl_percent', data.positionPnlPercent);
    if (data.positionSize !== undefined) this.setGauge('trading_bot_position_size', data.positionSize);
    if (data.positionLeverage !== undefined) this.setGauge('trading_bot_position_leverage', data.positionLeverage);
  }

  /**
   * Actualiza métricas de IA
   */
  updateAIMetrics(data: {
    confidence?: number;
    decision?: string;
    kalmanConfidence?: number;
  }): void {
    if (data.confidence !== undefined) this.setGauge('trading_bot_ai_confidence', data.confidence * 100);
    if (data.kalmanConfidence !== undefined) this.setGauge('trading_bot_kalman_confidence', data.kalmanConfidence * 100);
    if (data.decision !== undefined) {
      this.incrementCounter('trading_bot_ai_decisions');
    }
  }

  /**
   * Actualiza métricas de indicadores técnicos
   */
  updateTechnicalIndicators(data: {
    rsi?: number;
    macdHistogram?: number;
    macdLine?: number;
    macdSignal?: number;
  }): void {
    if (data.rsi !== undefined) this.setGauge('trading_bot_rsi', data.rsi);
    if (data.macdHistogram !== undefined) this.setGauge('trading_bot_macd_histogram', data.macdHistogram);
    if (data.macdLine !== undefined) this.setGauge('trading_bot_macd_line', data.macdLine);
    if (data.macdSignal !== undefined) this.setGauge('trading_bot_macd_signal', data.macdSignal);
  }

  /**
   * Actualiza métricas de salud
   */
  updateHealthMetrics(data: {
    ollamaHealth?: boolean;
    bybitHealth?: boolean;
  }): void {
    if (data.ollamaHealth !== undefined) this.setGauge('trading_bot_ollama_health', data.ollamaHealth ? 1 : 0);
    if (data.bybitHealth !== undefined) this.setGauge('trading_bot_bybit_health', data.bybitHealth ? 1 : 0);
  }

  /**
   * Registra un trade ejecutado
   */
  recordTrade(side: 'buy' | 'sell', success: boolean): void {
    this.incrementCounter('trading_bot_trades_total');
    this.setGauge('trading_bot_last_trade_timestamp', Date.now() / 1000);
    console.log('recordTrade', side, success);
    
    if (success) {
      this.incrementCounter('trading_bot_trades_winning');
    } else {
      this.incrementCounter('trading_bot_trades_losing');
    }
    
    // Calcular win rate
    const winning = this.metrics.get('trading_bot_trades_winning')?.value || 0;
    const losing = this.metrics.get('trading_bot_trades_losing')?.value || 0;
    const total = winning + losing;

    if (total > 0) {
      const winRate = (winning / total) * 100;
      this.setGauge('trading_bot_win_rate', winRate);
    }
  }

  /**
   * Registra un error
   */
  recordError(type?: string): void {
    this.incrementCounter('trading_bot_errors_total');
    console.log('recordError', type);
  }

  /**
   * Registra duración de análisis
   */
  recordAnalysisDuration(seconds: number): void {
    this.observeHistogram('trading_bot_analysis_duration_seconds', seconds);
  }

  /**
   * Registra duración de ejecución de trade
   */
  recordTradeExecutionDuration(seconds: number): void {
    this.observeHistogram('trading_bot_trade_execution_duration_seconds', seconds);
  }

  /**
   * Cierra el servidor de métricas
   */
  close(): void {
    if (this.server) {
      this.server.close();
      this.logger.info('Servidor de métricas cerrado');
    }
  }
}

// Singleton para uso global
let metricsInstance: MetricsCollector | null = null;

export function initializeMetrics(port: number = 9090): MetricsCollector {
  if (!metricsInstance) {
    metricsInstance = new MetricsCollector(port);
  }
  return metricsInstance;
}

export function getMetrics(): MetricsCollector {
  if (!metricsInstance) {
    throw new Error('Metrics not initialized. Call initializeMetrics() first.');
  }
  return metricsInstance;
}
