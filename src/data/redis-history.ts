import Redis from 'ioredis';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Gestor de historial persistente en Redis
 * Mantiene contexto de decisiones, stats y patrones para mejorar decisiones de IA
 */
export class RedisHistoryManager {
  private redis: Redis;
  private logger: Logger;
  private symbol: string;

  constructor(symbol: string = 'BTCUSDT') {
    this.logger = new Logger('RedisHistory');
    this.symbol = symbol;
    
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');
    
    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3
    });

    this.redis.on('connect', () => {
      this.logger.info(`✅ Conectado a Redis: ${redisHost}:${redisPort}`);
    });

    this.redis.on('error', (err) => {
      this.logger.error('Error de conexión con Redis:', err);
    });
  }

  /**
   * Registra apertura de posición
   */
  async recordTradeOpen(decision: {
    action: string;
    confidence: number;
    price: number;
    rsi: number;
    macdHistogram: number;
    kalmanTrend: string;
    leverage: number;
    quantity: number;
  }): Promise<string> {
    try {
      const tradeId = uuidv4();
      const timestamp = Date.now();

      const tradeData = {
        id: tradeId,
        timestamp,
        decision: decision.action,
        confidence: decision.confidence,
        entry: {
          price: decision.price,
          rsi: decision.rsi,
          macd_histogram: decision.macdHistogram,
          kalman_trend: decision.kalmanTrend,
          leverage: decision.leverage,
          quantity: decision.quantity
        },
        exit: null,
        result: 'PENDING'
      };

      // Guardar en lista de decisiones (últimas 20)
      await this.redis.lpush(
        `trading:decisions:${this.symbol}`,
        JSON.stringify(tradeData)
      );
      
      // Mantener solo últimas 20 decisiones
      await this.redis.ltrim(`trading:decisions:${this.symbol}`, 0, 19);

      // Guardar referencia activa
      await this.redis.set(
        `trading:position:${this.symbol}:current`,
        JSON.stringify({
          trade_id: tradeId,
          entry_time: timestamp,
          checks_count: 0,
          ai_decisions: [],
          max_pnl_reached: 0,
          min_pnl_reached: 0
        }),
        'EX',
        86400 // 24 horas
      );

      this.logger.info(`📝 Trade registrado: ${tradeId} | ${decision.action} @ $${decision.price}`);
      return tradeId;
    } catch (error) {
      this.logger.error('Error registrando trade open:', error);
      return '';
    }
  }

  /**
   * Registra cierre de posición (TP/SL/Liquidación/Manual)
   */
  async recordTradeClose(
    tradeId: string,
    exitData: {
      type: 'TAKE_PROFIT' | 'STOP_LOSS' | 'LIQUIDATION' | 'MANUAL_CLOSE';
      price: number;
      pnl: number;
      pnlPercent: number;
      durationMinutes: number;
    }
  ): Promise<void> {
    try {
      // Determinar resultado
      const result = exitData.type === 'LIQUIDATION' ? 'LIQUIDATION' :
                     exitData.pnl > 0 ? 'WIN' : 'LOSS';

      // Actualizar en lista de decisiones
      const decisions = await this.redis.lrange(`trading:decisions:${this.symbol}`, 0, -1);
      let updated = false;

      for (let i = 0; i < decisions.length; i++) {
        const trade = JSON.parse(decisions[i]);
        if (trade.id === tradeId) {
          trade.exit = {
            type: exitData.type,
            price: exitData.price,
            pnl: exitData.pnl,
            pnl_percent: exitData.pnlPercent,
            duration_minutes: exitData.durationMinutes,
            timestamp: Date.now()
          };
          trade.result = result;
          
          await this.redis.lset(`trading:decisions:${this.symbol}`, i, JSON.stringify(trade));
          updated = true;
          break;
        }
      }

      if (!updated) {
        this.logger.warn(`Trade ${tradeId} no encontrado en historial`);
      }

      // Actualizar stats diarias
      const today = this.getTodayKey();
      await this.redis.hincrby(`trading:daily:${today}`, 'trades', 1);

      if (result === 'WIN') {
        await this.redis.hincrby(`trading:daily:${today}`, 'wins', 1);
        await this.redis.hincrbyfloat(`trading:daily:${today}`, 'pnl_from_wins', exitData.pnl);
        await this.redis.hincrbyfloat(`trading:daily:${today}`, 'pnl_realized', exitData.pnl);
      } else if (result === 'LIQUIDATION') {
        await this.redis.hincrby(`trading:daily:${today}`, 'liquidations', 1);
        await this.redis.hincrbyfloat(`trading:daily:${today}`, 'pnl_from_losses', exitData.pnl);
        await this.redis.hincrbyfloat(`trading:daily:${today}`, 'pnl_realized', exitData.pnl);
      } else {
        await this.redis.hincrby(`trading:daily:${today}`, 'losses', 1);
        await this.redis.hincrbyfloat(`trading:daily:${today}`, 'pnl_from_losses', exitData.pnl);
        await this.redis.hincrbyfloat(`trading:daily:${today}`, 'pnl_realized', exitData.pnl);
      }

      // Actualizar CONTADOR GLOBAL (nunca se resetea)
      await this.redis.hincrby('trading:global:stats', 'total_trades', 1);
      
      if (result === 'WIN') {
        await this.redis.hincrby('trading:global:stats', 'total_wins', 1);
      } else if (result === 'LIQUIDATION') {
        await this.redis.hincrby('trading:global:stats', 'total_liquidations', 1);
      } else {
        await this.redis.hincrby('trading:global:stats', 'total_losses', 1);
      }
      
      await this.redis.hincrbyfloat('trading:global:stats', 'total_pnl', exitData.pnl);

      // Limpiar posición actual
      await this.redis.del(`trading:position:${this.symbol}:current`);

      this.logger.info(`✅ Trade cerrado: ${tradeId} | ${result} | PnL: ${exitData.pnl.toFixed(2)}`);
    } catch (error) {
      this.logger.error('Error registrando trade close:', error);
    }
  }

  /**
   * Obtiene contexto histórico para el prompt de IA
   */
  async getContextForAI(): Promise<{
    recent: any[];
    daily: any;
    global: any;
    patterns: string[];
  }> {
    try {
      // Obtener últimas 5 decisiones
      const recentDecisions = await this.redis.lrange(`trading:decisions:${this.symbol}`, 0, 4);
      const recent = recentDecisions
        .map(d => JSON.parse(d))
        .filter(d => d.result !== 'PENDING'); // Solo trades cerrados

      // Stats diarias
      const today = this.getTodayKey();
      const dailyData = await this.redis.hgetall(`trading:daily:${today}`);
      
      const daily = {
        trades: parseInt(dailyData.trades || '0'),
        wins: parseInt(dailyData.wins || '0'),
        losses: parseInt(dailyData.losses || '0'),
        liquidations: parseInt(dailyData.liquidations || '0'),
        pnl_realized: parseFloat(dailyData.pnl_realized || '0'),
        pnl_from_wins: parseFloat(dailyData.pnl_from_wins || '0'),
        pnl_from_losses: parseFloat(dailyData.pnl_from_losses || '0'),
        win_rate: parseInt(dailyData.wins || '0') / 
                 Math.max(parseInt(dailyData.wins || '0') + parseInt(dailyData.losses || '0'), 1) * 100
      };

      // Stats globales
      const globalData = await this.redis.hgetall('trading:global:stats');
      
      const global = {
        total_trades: parseInt(globalData.total_trades || '0'),
        total_wins: parseInt(globalData.total_wins || '0'),
        total_losses: parseInt(globalData.total_losses || '0'),
        total_liquidations: parseInt(globalData.total_liquidations || '0'),
        total_pnl: parseFloat(globalData.total_pnl || '0'),
        win_rate: parseInt(globalData.total_wins || '0') / 
                 Math.max(parseInt(globalData.total_wins || '0') + parseInt(globalData.total_losses || '0'), 1) * 100
      };

      // Análisis de patrones exitosos
      const patterns = this.analyzePatterns(recent);

      return { recent, daily, global, patterns };
    } catch (error) {
      this.logger.error('Error obteniendo contexto para IA:', error);
      return { recent: [], daily: {}, global: {}, patterns: [] };
    }
  }

  /**
   * Analiza patrones de éxito/fracaso
   */
  private analyzePatterns(decisions: any[]): string[] {
    const patterns: string[] = [];
    
    // Analizar rangos de RSI exitosos
    const winsByRsi = decisions.filter(d => d.result === 'WIN');
    const lossesByRsi = decisions.filter(d => d.result === 'LOSS' || d.result === 'LIQUIDATION');

    if (winsByRsi.length >= 2) {
      const avgWinRsi = winsByRsi.reduce((sum, d) => sum + d.entry.rsi, 0) / winsByRsi.length;
      patterns.push(`RSI promedio en wins: ${avgWinRsi.toFixed(0)}`);
    }

    if (lossesByRsi.length >= 2) {
      const avgLossRsi = lossesByRsi.reduce((sum, d) => sum + d.entry.rsi, 0) / lossesByRsi.length;
      patterns.push(`⚠️ RSI promedio en losses: ${avgLossRsi.toFixed(0)}`);
    }

    // Detectar si hay liquidaciones
    const liquidations = decisions.filter(d => d.result === 'LIQUIDATION');
    if (liquidations.length > 0) {
      const avgLiqLeverage = liquidations.reduce((sum, d) => sum + d.entry.leverage, 0) / liquidations.length;
      patterns.push(`⚠️ CUIDADO: ${liquidations.length} liquidaciones con leverage ~${avgLiqLeverage.toFixed(0)}x`);
    }

    return patterns;
  }

  /**
   * Formatea el contexto para el prompt de Ollama
   */
  formatContextForPrompt(context: any): string {
    let prompt = '\n═══════════════════════════════════════════════════════════════\n';
    prompt += '📊 HISTORIAL Y CONTEXTO DEL SISTEMA\n';
    prompt += '═══════════════════════════════════════════════════════════════\n\n';

    // Historial reciente
    if (context.recent.length > 0) {
      prompt += '📜 ÚLTIMAS DECISIONES:\n\n';
      context.recent.forEach((trade: any, i: number) => {
        const icon = trade.result === 'WIN' ? '✅' : 
                    trade.result === 'LIQUIDATION' ? '💥' : '❌';
        const entry = trade.entry;
        const exit = trade.exit;
        
        prompt += `${i + 1}. ${icon} ${trade.decision} @ $${entry.price.toLocaleString()} (RSI:${entry.rsi.toFixed(0)}, MACD:${entry.macd_histogram > 0 ? '+' : ''}${entry.macd_histogram.toFixed(4)})\n`;
        prompt += `   → ${exit.type} @ $${exit.price.toLocaleString()} | ${exit.pnl > 0 ? '+' : ''}$${exit.pnl.toFixed(2)} (${exit.pnl_percent > 0 ? '+' : ''}${exit.pnl_percent.toFixed(2)}%) en ${exit.duration_minutes}min\n`;
        
        if (trade.result === 'LIQUIDATION') {
          prompt += `   ⚠️ LIQUIDACIÓN con leverage ${entry.leverage}x - EVITAR condiciones similares\n`;
        }
        prompt += '\n';
      });
    }

    // Stats diarias
    if (context.daily.trades > 0) {
      prompt += '📈 ESTADÍSTICAS DE HOY:\n';
      prompt += `- Trades: ${context.daily.trades}/20\n`;
      prompt += `- Wins: ${context.daily.wins} | Losses: ${context.daily.losses}`;
      if (context.daily.liquidations > 0) {
        prompt += ` | Liquidaciones: ${context.daily.liquidations} ⚠️`;
      }
      prompt += '\n';
      prompt += `- Win Rate: ${context.daily.win_rate.toFixed(1)}%\n`;
      prompt += `- PnL Hoy: ${context.daily.pnl_realized > 0 ? '+' : ''}$${context.daily.pnl_realized.toFixed(2)}`;
      if (context.daily.pnl_from_wins > 0) {
        prompt += ` (Wins: +$${context.daily.pnl_from_wins.toFixed(2)} | Losses: $${context.daily.pnl_from_losses.toFixed(2)})`;
      }
      prompt += '\n\n';
    }

    // Stats globales
    if (context.global.total_trades > 0) {
      prompt += '📊 ESTADÍSTICAS GLOBALES:\n';
      prompt += `- Total Trades: ${context.global.total_trades}\n`;
      prompt += `- Win Rate Global: ${context.global.win_rate.toFixed(1)}%\n`;
      if (context.global.total_liquidations > 0) {
        const liqRate = (context.global.total_liquidations / context.global.total_trades * 100).toFixed(1);
        prompt += `- Total Liquidaciones: ${context.global.total_liquidations} ⚠️ (${liqRate}% de trades)\n`;
      }
      prompt += `- PnL Acumulado: ${context.global.total_pnl > 0 ? '+' : ''}$${context.global.total_pnl.toFixed(2)}\n\n`;
    }

    // Patrones detectados
    if (context.patterns.length > 0) {
      prompt += '💡 PATRONES DETECTADOS:\n';
      context.patterns.forEach((pattern: string) => {
        prompt += `- ${pattern}\n`;
      });
      prompt += '\n';
    }

    prompt += '═══════════════════════════════════════════════════════════════\n\n';

    return prompt;
  }

  /**
   * Obtiene clave del día actual
   */
  private getTodayKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  /**
   * Verifica salud de Redis
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cierra conexión
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}
