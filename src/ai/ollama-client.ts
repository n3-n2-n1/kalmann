import axios, { AxiosInstance } from 'axios';
import { AIAnalysis, OllamaConfig } from '../types';
import { Logger } from '../utils/logger';

/**
 * Cliente para interactuar con Ollama y obtener análisis de IA
 */
export class OllamaClient {
  private client: AxiosInstance;
  private logger: Logger;
  private config: OllamaConfig;

  constructor() {
    this.logger = new Logger('OllamaClient');
    this.config = {
      host: process.env.OLLAMA_HOST || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'llama2:7b-chat',
      timeout: parseInt(process.env.OLLAMA_TIMEOUT || '30000')
    };

    this.client = axios.create({
      baseURL: this.config.host,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.logger.info(`Cliente Ollama inicializado: ${this.config.host} - ${this.config.model}`);
  }

  /**
   * Analiza datos de mercado y devuelve decisión de trading
   */
  async analyze(prompt: string): Promise<AIAnalysis> {
    try {
      this.logger.debug('Enviando prompt a Ollama para análisis');
      
      const response = await this.client.post('/api/generate', {
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,  // Menor temperatura para decisiones más consistentes
          top_p: 0.9,
          top_k: 40,
          num_predict: 500
        }
      });

      const aiResponse = response.data.response;
      this.logger.debug('Respuesta recibida de Ollama');

      // Parsear la respuesta JSON del modelo
      const analysis = this.parseAIResponse(aiResponse);
      
      // Validar y limpiar la respuesta
      return this.validateAndCleanAnalysis(analysis);

    } catch (error) {
      this.logger.error('Error en análisis de Ollama:', error);
      
      // Devolver análisis conservador en caso de error
      return {
        decision: 'HOLD',
        confidence: 0.1,
        reasoning: `Error en análisis de IA: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        indicators: {} as any,
        kalman: {} as any,
        marketSentiment: 'neutral',
        riskLevel: 'high',
        suggestedLeverage: 1
      };
    }
  }

  /**
   * Genera un análisis de sentimiento del mercado
   */
  async analyzeSentiment(marketNews: string[], priceAction: string): Promise<{
    sentiment: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    factors: string[];
  }> {
    const prompt = `
Analiza el sentimiento del mercado basado en:

NOTICIAS:
${marketNews.join('\n')}

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
      const response = await this.client.post('/api/generate', {
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 200
        }
      });

      return JSON.parse(this.extractJSON(response.data.response));
    } catch (error) {
      this.logger.error('Error en análisis de sentimiento:', error);
      return {
        sentiment: 'neutral',
        confidence: 0.1,
        factors: ['Error en análisis']
      };
    }
  }

  /**
   * Genera estrategia de trading personalizada
   */
  async generateStrategy(
    symbol: string,
    timeframe: string,
    riskTolerance: 'low' | 'medium' | 'high',
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
      const response = await this.client.post('/api/generate', {
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.4,
          num_predict: 400
        }
      });

      return JSON.parse(this.extractJSON(response.data.response));
    } catch (error) {
      this.logger.error('Error generando estrategia:', error);
      return {
        strategy: 'Estrategia Conservadora',
        entryRules: ['RSI < 30 para compra', 'RSI > 70 para venta'],
        exitRules: ['Stop loss 2%', 'Take profit 4%'],
        riskManagement: ['Máximo 2% del balance por trade'],
        expectedReturn: 0.02
      };
    }
  }

  /**
   * Evalúa el riesgo de una operación específica
   */
  async evaluateTradeRisk(
    tradeParams: {
      symbol: string;
      side: 'Buy' | 'Sell';
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
      const response = await this.client.post('/api/generate', {
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1,  // Muy baja para evaluación de riesgo
          num_predict: 300
        }
      });

      return JSON.parse(this.extractJSON(response.data.response));
    } catch (error) {
      this.logger.error('Error evaluando riesgo:', error);
      return {
        riskScore: 1.0,  // Máximo riesgo en caso de error
        riskFactors: ['Error en evaluación de IA'],
        recommendations: ['No ejecutar trade por error en análisis'],
        approved: false
      };
    }
  }

  /**
   * Verifica si Ollama está disponible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/tags');
      const models = response.data.models || [];
      const modelExists = models.some((model: any) => model.name === this.config.model);
      
      if (!modelExists) {
        this.logger.warn(`Modelo ${this.config.model} no encontrado en Ollama`);
        return false;
      }

      this.logger.info('Health check de Ollama exitoso');
      return true;
    } catch (error) {
      this.logger.error('Health check de Ollama falló:', error);
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
      this.logger.warn('No se pudo parsear JSON de la respuesta, usando parser de fallback');
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
    throw new Error('No se encontró JSON válido en la respuesta');
  }

  /**
   * Parser de fallback cuando no se puede extraer JSON
   */
  private fallbackParser(response: string): any {
    this.logger.debug('Usando parser de fallback para respuesta de IA');
    
    // Análisis básico de texto para extraer decisión
    const lowerResponse = response.toLowerCase();
    
    let decision = 'HOLD';
    if (lowerResponse.includes('buy') || lowerResponse.includes('compra')) {
      decision = 'BUY';
    } else if (lowerResponse.includes('sell') || lowerResponse.includes('venta')) {
      decision = 'SELL';
    }

    return {
      decision,
      confidence: 0.3,
      reasoning: response.substring(0, 200),
      marketSentiment: 'neutral',
      riskLevel: 'medium',
      suggestedLeverage: 2
    };
  }

  /**
   * Valida y limpia el análisis de IA
   */
  private validateAndCleanAnalysis(analysis: any): AIAnalysis {
    return {
      decision: ['BUY', 'SELL', 'HOLD'].includes(analysis.decision) ? analysis.decision : 'HOLD',
      confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5)),
      reasoning: analysis.reasoning || 'Sin razonamiento proporcionado',
      indicators: analysis.indicators || {},
      kalman: analysis.kalman || {},
      marketSentiment: ['bullish', 'bearish', 'neutral'].includes(analysis.marketSentiment) 
        ? analysis.marketSentiment : 'neutral',
      riskLevel: ['low', 'medium', 'high'].includes(analysis.riskLevel) 
        ? analysis.riskLevel : 'medium',
      suggestedLeverage: Math.max(1, Math.min(10, analysis.suggestedLeverage || 2))
    };
  }
}
