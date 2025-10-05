import axios, { AxiosInstance } from "axios";
import { AIAnalysis, OllamaConfig } from "../types";
import { Logger } from "../utils/logger";

/**
 * Cliente para interactuar con Ollama y obtener análisis de IA
 */
export class OllamaClient {
  private client: AxiosInstance;
  private logger: Logger;
  private config: OllamaConfig;

  constructor() {
    this.logger = new Logger("OllamaClient");
    this.config = {
      host: process.env.OLLAMA_HOST || "http://localhost:11434",
      model: process.env.OLLAMA_MODEL || "llama2:7b-chat",
      timeout: parseInt(process.env.OLLAMA_TIMEOUT || "120000"), // 120 segundos por defecto
    };

    this.client = axios.create({
      baseURL: this.config.host,
      timeout: this.config.timeout,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.logger.info(
      `Cliente Ollama inicializado: ${this.config.host} - ${this.config.model} (timeout: ${this.config.timeout}ms)`
    );
  }

  /**
   * Analiza datos de mercado y devuelve decisión de trading
   */
  async analyze(prompt: string): Promise<AIAnalysis> {
    try {
      this.logger.debug("Enviando prompt a Ollama para análisis");
      
      const response = await this.client.post("/api/generate", {
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.35, // Menor temperatura para decisiones más consistentes
          top_p: 0.9,
          top_k: 40,
          num_predict: 500,
        },
      });

      const aiResponse = response.data.response;
      this.logger.debug("Respuesta recibida de Ollama");

      // Parsear la respuesta JSON del modelo
      const analysis = this.parseAIResponse(aiResponse);
      
      // Validar y limpiar la respuesta
      return this.validateAndCleanAnalysis(analysis);
    } catch (error) {
      this.logger.error("Error en análisis de Ollama:", error);
      
      // Devolver análisis conservador en caso de error
      return {
        decision: "HOLD",
        confidence: 0.1,
        reasoning: `Error en análisis de IA: ${error instanceof Error ? error.message : "Error desconocido"}`,
        indicators: {} as any,
        kalman: {} as any,
        marketSentiment: "neutral",
        riskLevel: "high",
        suggestedLeverage: 1,
      };
    }
  }

  /**
   * Genera un análisis de sentimiento del mercado
   */
  async analyzeSentiment(priceAction: string): Promise<{
    sentiment: "bullish" | "bearish" | "neutral";
    confidence: number;
    factors: string[];
  }> {
    const prompt = `
Analiza el sentimiento del mercado basado en:

ACCIÓN DEL PRECIO:
${priceAction}

Responde en formato JSON:
{
  "sentiment": "bullish|bearish|neutral",
  "confidence": 0.0-1.0,
  "factors": ["factor1", "factor2", "factor3"]
}
    `;

    try {
      const response = await this.client.post("/api/generate", {
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 200,
        },
      });

      return JSON.parse(this.extractJSON(response.data.response));
    } catch (error) {
      this.logger.error("Error en análisis de sentimiento:", error);
      return {
        sentiment: "neutral",
        confidence: 0.1,
        factors: ["Error en análisis"],
      };
    }
  }

  /**
   * Genera estrategia de trading personalizada
   */
  async generateStrategy(
    symbol: string,
    timeframe: string,
    riskTolerance: "low" | "medium" | "high",
    marketCondition: string
  ): Promise<{
    strategy: string;
    entryRules: string[];
    exitRules: string[];
    riskManagement: string[];
    expectedReturn: number;
  }> {
    const prompt = `
Genera una estrategia de trading para:
- Símbolo: ${symbol}
- Timeframe: ${timeframe}
- Tolerancia al riesgo: ${riskTolerance}
- Condición del mercado: ${marketCondition}

Responde en formato JSON:
{
  "strategy": "Nombre de la estrategia",
  "entryRules": ["regla1", "regla2"],
  "exitRules": ["regla1", "regla2"],
  "riskManagement": ["regla1", "regla2"],
  "expectedReturn": 0.05
}
    `;

    try {
      const response = await this.client.post("/api/generate", {
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.4,
          num_predict: 400,
        },
      });

      return JSON.parse(this.extractJSON(response.data.response));
    } catch (error) {
      this.logger.error("Error generando estrategia:", error);
      return {
        strategy: "Estrategia Conservadora",
        entryRules: ["RSI < 30 para compra", "RSI > 70 para venta"],
        exitRules: ["Stop loss 2%", "Take profit 4%"],
        riskManagement: ["Máximo 2% del balance por trade"],
        expectedReturn: 0.02,
      };
    }
  }

  /**
   * Evalúa el riesgo de una operación específica
   */
  async evaluateTradeRisk(
    tradeParams: {
      symbol: string;
      side: "Buy" | "Sell";
      leverage: number;
      quantity: number;
      currentPrice: number;
    },
    marketContext: any
  ): Promise<{
    riskScore: number;
    riskFactors: string[];
    recommendations: string[];
    approved: boolean;
  }> {
    const prompt = `
Evalúa el riesgo de esta operación:

PARÁMETROS:
${JSON.stringify(tradeParams, null, 2)}

CONTEXTO DE MERCADO:
${JSON.stringify(marketContext, null, 2)}

Responde en formato JSON:
{
  "riskScore": 0.0-1.0,
  "riskFactors": ["factor1", "factor2"],
  "recommendations": ["recomendación1", "recomendación2"],
  "approved": true/false
}
    `;

    try {
      const response = await this.client.post("/api/generate", {
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1, // Muy baja para evaluación de riesgo
          num_predict: 300,
        },
      });

      return JSON.parse(this.extractJSON(response.data.response));
    } catch (error) {
      this.logger.error("Error evaluando riesgo:", error);
      return {
        riskScore: 1.0, // Máximo riesgo en caso de error
        riskFactors: ["Error en evaluación de IA"],
        recommendations: ["No ejecutar trade por error en análisis"],
        approved: false,
      };
    }
  }

  /**
   * Analiza una posición existente y decide si mantener, cerrar parcial o cerrar completa
   */
  async analyzePosition(
    position: any,
    marketData: any,
    technical: any,
    kalman: any,
    timeInPosition: number
  ): Promise<{
    action: "HOLD" | "CLOSE_25" | "CLOSE_50" | "CLOSE_100";
    confidence: number;
    reasoning: string;
    riskLevel: string;
  }> {
    const isLongPosition = position.side === 'Buy';
    const isShortPosition = position.side === 'Sell';
    const isProfitable = position.pnlPercentage > 0;
    
    // Detectar señales de reversión específicas según tipo de posición
    const reversal_signals = [];
    if (isLongPosition) {
      if (technical.rsi > 70) reversal_signals.push('RSI sobrecomprado (>70) - posible caída');
      if (technical.macd.histogram < 0) reversal_signals.push('MACD bajista - momentum negativo');
      if (technical.ema.ema9 < technical.ema.ema21) reversal_signals.push('EMA9 cruza debajo EMA21 - death cross');
      if (kalman.trend === 'bearish') reversal_signals.push('Kalman predice bajada');
    } else if (isShortPosition) {
      if (technical.rsi < 30) reversal_signals.push('RSI sobrevendido (<30) - posible rebote');
      if (technical.macd.histogram > 0) reversal_signals.push('MACD alcista - momentum positivo');
      if (technical.ema.ema9 > technical.ema.ema21) reversal_signals.push('EMA9 cruza encima EMA21 - golden cross');
      if (kalman.trend === 'bullish') reversal_signals.push('Kalman predice subida');
    }

    const prompt = `
Eres un trader profesional de SCALPING analizando una posición ACTIVA. Debes decidir si mantener o cerrar.

POSICIÓN ACTUAL:
- Símbolo: ${position.symbol}
- Lado: ${position.side} ${isLongPosition ? '(LONG - apostando a SUBIDA)' : '(SHORT - apostando a BAJADA)'}
- Tamaño: ${position.size}
- Precio entrada: $${position.entryPrice}
- Precio actual: $${position.currentPrice}
- PnL: ${position.pnl.toFixed(2)} USDT (${position.pnlPercentage.toFixed(3)}%) ${isProfitable ? '🟢 GANANDO' : '🔴 PERDIENDO'}
- Tiempo en posición: ${timeInPosition.toFixed(2)} horas
- Leverage: ${position.leverage}x

MERCADO ACTUAL:
- Precio: $${marketData.price}
- Cambio 24h: ${marketData.change24h.toFixed(2)}%
- Volumen: ${marketData.volume}

INDICADORES TÉCNICOS:
- RSI: ${technical.rsi.toFixed(2)} ${technical.rsi > 70 ? "🔴 OVERBOUGHT" : technical.rsi < 30 ? "🟢 OVERSOLD" : ""}
- MACD Histogram: ${technical.macd.histogram.toFixed(6)} ${technical.macd.histogram > 0 ? "🟢 BULLISH" : "🔴 BEARISH"}
- EMA9: ${technical.ema.ema9.toFixed(2)}, EMA21: ${technical.ema.ema21.toFixed(2)} ${technical.ema.ema9 > technical.ema.ema21 ? '(alcista)' : '(bajista)'}
- Volumen ratio: ${technical.volume.ratio.toFixed(2)}x ${technical.volume.ratio > 2 ? '⚡ MUY ALTO' : ''}

PREDICCIÓN KALMAN:
- Precio predicho: $${kalman.predictedPrice.toFixed(2)}
- Tendencia: ${kalman.trend === 'bullish' ? '🟢 ALCISTA' : kalman.trend === 'bearish' ? '🔴 BAJISTA' : '➡️  LATERAL'}
- Confianza: ${(kalman.confidence * 100).toFixed(1)}%

🚨 SEÑALES DE REVERSIÓN DETECTADAS:
${reversal_signals.length > 0 ? reversal_signals.map((s, i) => `${i + 1}. ${s}`).join('\n') : 'Ninguna señal de reversión detectada.'}

═══════════════════════════════════════════════════════════════
ESTRATEGIA SCALPING - REGLAS DE DECISIÓN:
═══════════════════════════════════════════════════════════════

1. **HOLD**: Mantener posición si:
   ${isLongPosition ? '- Tendencia ALCISTA continúa (RSI<60, MACD>0, EMA9>EMA21)' : '- Tendencia BAJISTA continúa (RSI>40, MACD<0, EMA9<EMA21)'}
   - PnL < 0.3% y NO hay señales de reversión
   - Kalman apoya la dirección de tu posición
   
2. **CLOSE_25**: Cerrar 25% si:
   - PnL >= 0.3% (asegurar primera ganancia)
   - 1 señal de reversión débil aparece
   - Volumen aumenta pero sin confirmación clara
   
3. **CLOSE_50**: Cerrar 50% si:
   - PnL >= 0.6% (buena ganancia para scalping)
   - 2+ señales de reversión aparecen
   - RSI extremo (${isLongPosition ? '>75' : '<25'})
   - Volumen spike (ratio > 3x) con divergencia
   
4. **CLOSE_100**: Cerrar TODO si:
   ${isLongPosition 
     ? '- RSI > 70 + MACD negativo (reversión bajista fuerte)\n   - EMA9 cruza DEBAJO de EMA21 (death cross)\n   - Kalman predice BAJADA con confianza > 70%'
     : '- RSI < 30 + MACD positivo (reversión alcista fuerte)\n   - EMA9 cruza ENCIMA de EMA21 (golden cross)\n   - Kalman predice SUBIDA con confianza > 70%'}
   - PnL >= 1.0% (excelente ganancia, asegurar)
   - Tiempo > 2 horas y PnL < 0.2% (posición estancada)
   - PnL < -0.8% (stop loss - cortar pérdidas)

IMPORTANTE:
✅ En SCALPING: mejor salir con +0.4% que arriesgar reversión
✅ Si eres LONG y ves señales BAJISTAS → cerrar rápido
✅ Si eres SHORT y ves señales ALCISTAS → cerrar rápido
✅ NO seas codicioso: toma profits pequeños consistentes
✅ Protege capital: es mejor salir temprano que tarde

Responde en formato JSON:
{
  "action": "HOLD|CLOSE_25|CLOSE_50|CLOSE_100",
  "confidence": 0.0-1.0,
  "reasoning": "Explicación ESPECÍFICA mencionando qué indicadores y por qué (RSI, MACD, EMA, Kalman, señales de reversión)",
  "riskLevel": "low|medium|high"
}

ANÁLISIS: Tienes una posición ${isLongPosition ? 'LONG' : 'SHORT'} con ${isProfitable ? 'ganancia' : 'pérdida'} de ${Math.abs(position.pnlPercentage).toFixed(2)}%.
${reversal_signals.length > 0 ? `⚠️  HAY ${reversal_signals.length} SEÑAL(ES) DE REVERSIÓN - considera cerrar.` : '✅ Sin señales de reversión - posición saludable.'}
    `;

    try {
      this.logger.info("Consultando a Ollama sobre posición activa...");

      const response = await this.client.post("/api/generate", {
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.2, // Más conservador para decisiones de salida
          top_p: 0.9,
          top_k: 40,
          num_predict: 250, // Respuesta más corta
        },
      });

      const aiResponse = response.data.response;
      this.logger.debug(
        `Respuesta de Ollama sobre posición: ${aiResponse.substring(0, 150)}...`
      );

      const analysis = this.parseAIResponse(aiResponse);

      // Validar y asegurar formato correcto
      const validatedAnalysis = {
        action: ["HOLD", "CLOSE_25", "CLOSE_50", "CLOSE_100"].includes(
          analysis.action
        )
          ? analysis.action
          : "HOLD",
        confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5)),
        reasoning: analysis.reasoning || "Sin razonamiento proporcionado",
        riskLevel: ["low", "medium", "high"].includes(analysis.riskLevel)
          ? analysis.riskLevel
          : "medium",
      };

      this.logger.info(
        `🤖 IA decide: ${validatedAnalysis.action} (Confianza: ${(validatedAnalysis.confidence * 100).toFixed(0)}%)`
      );

      return validatedAnalysis;
    } catch (error) {
      this.logger.error("Error en análisis de posición de Ollama:", error);

      // Fallback conservador: mantener la posición
      return {
        action: "HOLD",
        confidence: 0.5,
        reasoning: `Error en análisis de IA: ${error instanceof Error ? error.message : "Error desconocido"}`,
        riskLevel: "high",
      };
    }
  }

  /**
   * Verifica si Ollama está disponible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get("/api/tags");
      const models = response.data.models || [];
      const modelExists = models.some(
        (model: any) => model.name === this.config.model
      );
      
      if (!modelExists) {
        this.logger.warn(`Modelo ${this.config.model} no encontrado en Ollama`);
        return false;
      }

      this.logger.info("Health check de Ollama exitoso");
      return true;
    } catch (error) {
      this.logger.error("Health check de Ollama falló:", error);
      return false;
    }
  }

  /**
   * Parsea la respuesta de IA y extrae el JSON
   */
  private parseAIResponse(response: string): any {
    try {
      // Buscar JSON en la respuesta
      const jsonStr = this.extractJSON(response);
      return JSON.parse(jsonStr);
    } catch (error) {
      this.logger.warn(
        "No se pudo parsear JSON de la respuesta, usando parser de fallback"
      );
      return this.fallbackParser(response);
    }
  }

  /**
   * Extrae JSON de una cadena de texto
   */
  private extractJSON(text: string): string {
    // Buscar patrones de JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    
    // Si no encuentra JSON, intentar construir uno básico
    throw new Error("No se encontró JSON válido en la respuesta");
  }

  /**
   * Parser de fallback cuando no se puede extraer JSON
   */
  private fallbackParser(response: string): any {
    this.logger.debug("Usando parser de fallback para respuesta de IA");
    
    // Análisis básico de texto para extraer decisión
    const lowerResponse = response.toLowerCase();
    
    let decision = "HOLD";
    if (lowerResponse.includes("buy") || lowerResponse.includes("compra")) {
      decision = "BUY";
    } else if (
      lowerResponse.includes("sell") ||
      lowerResponse.includes("venta")
    ) {
      decision = "SELL";
    }

    return {
      decision,
      confidence: 0.3,
      reasoning: response.substring(0, 200),
      marketSentiment: "neutral",
      riskLevel: "medium",
      suggestedLeverage: 2,
    };
  }

  /**
   * Valida y limpia el análisis de IA
   */
  private validateAndCleanAnalysis(analysis: any): AIAnalysis {
    return {
      decision: ["BUY", "SELL", "HOLD"].includes(analysis.decision)
        ? analysis.decision
        : "HOLD",
      confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5)),
      reasoning: analysis.reasoning || "Sin razonamiento proporcionado",
      indicators: analysis.indicators || {},
      kalman: analysis.kalman || {},
      marketSentiment: ["bullish", "bearish", "neutral"].includes(
        analysis.marketSentiment
      )
        ? analysis.marketSentiment
        : "neutral",
      riskLevel: ["low", "medium", "high"].includes(analysis.riskLevel)
        ? analysis.riskLevel
        : "medium",
      suggestedLeverage: Math.max(
        1,
        Math.min(10, analysis.suggestedLeverage || 2)
      ),
    };
  }
}
