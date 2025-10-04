import { Kline, KalmanPrediction } from '../types';
import { Logger } from '../utils/logger';

/**
 * Implementación del filtro de Kalman para predicción de precios
 * Utiliza el modelo de estado espacio para predecir movimientos futuros
 */
export class KalmanFilter {
  private logger: Logger;
  private state: {
    x: number;      // Estado estimado (precio)
    P: number;      // Covarianza del estado
    Q: number;      // Covarianza del proceso (ruido del modelo)
    R: number;      // Covarianza de la medición (ruido de observación)
  };

  constructor() {
    this.logger = new Logger('KalmanFilter');
    
    // Inicializar estado del filtro
    this.state = {
      x: 0,          // Precio inicial
      P: 1,          // Incertidumbre inicial
      Q: 0.01,       // Ruido del proceso (ajustable)
      R: 0.1         // Ruido de medición (ajustable)
    };
  }

  /**
   * Predice el precio futuro basado en datos históricos
   */
  async predict(klines: Kline[], lookAhead: number = 5): Promise<KalmanPrediction> {
    try {
      if (klines.length < 10) {
        throw new Error('Se necesitan al menos 10 velas para predicción');
      }

      // Preparar datos para el filtro
      const prices = klines.map(k => k.close);
      const volumes = klines.map(k => k.volume);
      
      // Calcular parámetros adaptativos
      const volatility = this.calculateVolatility(prices);
      const volumeTrend = this.calculateVolumeTrend(volumes);
      
      // Ajustar parámetros del filtro según volatilidad
      this.adaptFilterParameters(volatility, volumeTrend);
      
      // Ejecutar filtro de Kalman
      const predictions = this.runKalmanFilter(prices);
      
      // Generar predicción futura
      const futurePrediction = this.extrapolateFuture(predictions, lookAhead);
      
      // Calcular métricas de confianza
      const confidence = this.calculateConfidence(predictions, prices);
      const trend = this.determineTrend(predictions);
      const accuracy = this.calculateAccuracy(predictions, prices);
      
      this.logger.debug(`Predicción Kalman: ${futurePrediction} (Confianza: ${confidence.toFixed(3)})`);
      
      return {
        predictedPrice: futurePrediction,
        confidence,
        trend,
        timeframe: '5m',
        accuracy
      };
      
    } catch (error) {
      this.logger.error('Error en predicción Kalman:', error);
      
      // Retornar predicción conservadora en caso de error
      const lastPrice = klines[klines.length - 1].close;
      return {
        predictedPrice: lastPrice,
        confidence: 0.1,
        trend: 'neutral',
        timeframe: '5m',
        accuracy: 0.1
      };
    }
  }

  /**
   * Ejecuta el algoritmo del filtro de Kalman
   * Implementa el algoritmo recursivo estándar con fases de predicción y corrección
   */
  private runKalmanFilter(prices: number[]): number[] {
    const predictions: number[] = [];
    let x = prices[0];  // Estado inicial x_0|0
    let P = this.state.P;  // Covarianza inicial P_0|0
    
    for (let i = 0; i < prices.length; i++) {
      // === FASE DE PREDICCIÓN ===
      // x̂_k|k-1 = Φ_k x_k-1|k-1 (en nuestro caso Φ = 1, modelo simple)
      const x_pred = x;  // x̂_k|k-1
      const P_pred = P + this.state.Q;  // P̂_k|k-1 = Φ P_k-1|k-1 Φ^T + Q_k
      
      // === FASE DE CORRECCIÓN ===
      // K_k = P_k|k-1 H^T (H P_k|k-1 H^T + R_k)^-1 (en nuestro caso H = 1)
      const K = P_pred / (P_pred + this.state.R);  // Ganancia de Kalman
      
      // ỹ_k = z_k - H x̂_k|k-1 (residual de medición)
      const innovation = prices[i] - x_pred;  // ỹ_k
      
      // x̂_k|k = x̂_k|k-1 + K_k ỹ_k (actualización del estado)
      x = x_pred + K * innovation;
      
      // P̂_k|k = (I - K_k H) P̂_k|k-1 (actualización de covarianza)
      P = (1 - K) * P_pred;
      
      predictions.push(x);
    }
    
    return predictions;
  }

  /**
   * Extrapola predicciones futuras
   */
  private extrapolateFuture(predictions: number[], lookAhead: number): number {
    if (predictions.length < 2) {
      return predictions[predictions.length - 1] || 0;
    }
    
    // Calcular tendencia reciente
    const recent = predictions.slice(-5);
    const trend = this.calculateLinearTrend(recent);
    
    // Extrapolar usando la tendencia
    const lastPrediction = predictions[predictions.length - 1];
    const futurePrediction = lastPrediction + (trend * lookAhead);
    
    return futurePrediction;
  }

  /**
   * Calcula la tendencia lineal de una serie de datos
   */
  private calculateLinearTrend(data: number[]): number {
    if (data.length < 2) return 0;
    
    const n = data.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = data;
    
    // Calcular pendiente usando mínimos cuadrados
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  /**
   * Calcula la volatilidad de los precios
   */
  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Calcula la tendencia del volumen
   */
  private calculateVolumeTrend(volumes: number[]): number {
    if (volumes.length < 2) return 0;
    
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    
    return (recentVolume - avgVolume) / avgVolume;
  }

  /**
   * Adapta los parámetros del filtro según las condiciones del mercado
   */
  private adaptFilterParameters(volatility: number, volumeTrend: number): void {
    // Ajustar Q (ruido del proceso) según volatilidad
    this.state.Q = Math.max(0.001, Math.min(0.1, volatility * 0.1));
    
    // Ajustar R (ruido de medición) según tendencia de volumen
    const volumeFactor = Math.max(0.5, Math.min(2.0, 1 + volumeTrend));
    this.state.R = Math.max(0.01, Math.min(1.0, 0.1 * volumeFactor));
    
    this.logger.debug(`Parámetros adaptados - Q: ${this.state.Q.toFixed(4)}, R: ${this.state.R.toFixed(4)}`);
  }

  /**
   * Calcula la confianza de la predicción
   */
  private calculateConfidence(predictions: number[], actualPrices: number[]): number {
    if (predictions.length !== actualPrices.length) return 0;
    
    // Calcular error cuadrático medio
    const mse = predictions.reduce((sum, pred, i) => {
      return sum + Math.pow(pred - actualPrices[i], 2);
    }, 0) / predictions.length;
    
    // Convertir MSE a confianza (0-1)
    const maxError = Math.max(...actualPrices) - Math.min(...actualPrices);
    const normalizedError = Math.sqrt(mse) / maxError;
    
    return Math.max(0, Math.min(1, 1 - normalizedError));
  }

  /**
   * Determina la tendencia basada en las predicciones
   */
  private determineTrend(predictions: number[]): 'bullish' | 'bearish' | 'neutral' {
    if (predictions.length < 3) return 'neutral';
    
    const recent = predictions.slice(-3);
    const trend = this.calculateLinearTrend(recent);
    
    if (trend > 0.001) return 'bullish';
    if (trend < -0.001) return 'bearish';
    return 'neutral';
  }

  /**
   * Calcula la precisión histórica del filtro
   */
  private calculateAccuracy(predictions: number[], actualPrices: number[]): number {
    if (predictions.length < 2) return 0;
    
    let correctDirection = 0;
    let totalComparisons = 0;
    
    for (let i = 1; i < predictions.length; i++) {
      const predDirection = predictions[i] > predictions[i-1] ? 1 : -1;
      const actualDirection = actualPrices[i] > actualPrices[i-1] ? 1 : -1;
      
      if (predDirection === actualDirection) {
        correctDirection++;
      }
      totalComparisons++;
    }
    
    return totalComparisons > 0 ? correctDirection / totalComparisons : 0;
  }

  /**
   * Reinicia el estado del filtro
   */
  public reset(): void {
    this.state = {
      x: 0,
      P: 1,
      Q: 0.01,
      R: 0.1
    };
    this.logger.info('Estado del filtro de Kalman reiniciado');
  }

  /**
   * Actualiza los parámetros del filtro manualmente
   */
  public updateParameters(Q: number, R: number): void {
    this.state.Q = Math.max(0.001, Math.min(1, Q));
    this.state.R = Math.max(0.01, Math.min(10, R));
    this.logger.info(`Parámetros actualizados - Q: ${this.state.Q}, R: ${this.state.R}`);
  }

  /**
   * Obtiene el estado actual del filtro
   */
  public getState(): { x: number; P: number; Q: number; R: number } {
    return { ...this.state };
  }
}
