import { Kline, KalmanPrediction } from '../types';
/**
 * Implementación del filtro de Kalman para predicción de precios
 * Utiliza el modelo de estado espacio para predecir movimientos futuros
 */
export declare class KalmanFilter {
    private logger;
    private state;
    constructor();
    /**
     * Predice el precio futuro basado en datos históricos
     */
    predict(klines: Kline[], lookAhead?: number): Promise<KalmanPrediction>;
    /**
     * Ejecuta el algoritmo del filtro de Kalman
     * Implementa el algoritmo recursivo estándar con fases de predicción y corrección
     */
    private runKalmanFilter;
    /**
     * Extrapola predicciones futuras
     */
    private extrapolateFuture;
    /**
     * Calcula la tendencia lineal de una serie de datos
     */
    private calculateLinearTrend;
    /**
     * Calcula la volatilidad de los precios
     */
    private calculateVolatility;
    /**
     * Calcula la tendencia del volumen
     */
    private calculateVolumeTrend;
    /**
     * Adapta los parámetros del filtro según las condiciones del mercado
     */
    private adaptFilterParameters;
    /**
     * Calcula la confianza de la predicción
     */
    private calculateConfidence;
    /**
     * Determina la tendencia basada en las predicciones
     */
    private determineTrend;
    /**
     * Calcula la precisión histórica del filtro
     */
    private calculateAccuracy;
    /**
     * Reinicia el estado del filtro
     */
    reset(): void;
    /**
     * Actualiza los parámetros del filtro manualmente
     */
    updateParameters(Q: number, R: number): void;
    /**
     * Obtiene el estado actual del filtro
     */
    getState(): {
        x: number;
        P: number;
        Q: number;
        R: number;
    };
}
//# sourceMappingURL=kalman-filter.d.ts.map