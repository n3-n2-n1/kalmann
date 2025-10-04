import { createServer, Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { MCPRequest, MCPResponse, MCPTool } from '../types';
import { Logger } from '../utils/logger';
import { OllamaClient } from '../ai/ollama-client';
import { BybitClient } from '../exchange/bybit-client';
import { KalmanFilter } from '../analysis/kalman-filter';
import { TechnicalAnalysis } from '../analysis/technical-analysis';
import { RiskManager } from '../risk/risk-manager';

/**
 * Servidor MCP principal que orquesta todo el sistema de trading
 */
export class MCPServer {
  private server: Server;
  private wss: WebSocketServer;
  private logger: Logger;
  private ollama: OllamaClient;
  private bybit: BybitClient;
  private kalman: KalmanFilter;
  private technical: TechnicalAnalysis;
  private riskManager: RiskManager;
  private tools: Map<string, MCPTool>;
  private activeConnections: Set<WebSocket>;

  constructor(port: number = 3001) {
    this.logger = new Logger('MCPServer');
    this.tools = new Map();
    this.activeConnections = new Set();
    
    // Inicializar componentes
    this.ollama = new OllamaClient();
    this.bybit = new BybitClient();
    this.kalman = new KalmanFilter();
    this.technical = new TechnicalAnalysis();
    this.riskManager = new RiskManager();

    // Crear servidor HTTP y WebSocket
    this.server = createServer();
    this.wss = new WebSocketServer({ server: this.server });

    this.setupWebSocketHandlers();
    this.registerTools();
    
    this.server.listen(port, () => {
      this.logger.info(`Servidor MCP iniciado en puerto ${port}`);
    });
  }

  /**
   * Configura los manejadores de WebSocket para comunicación MCP
   */
  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      this.logger.info('Nueva conexión MCP establecida');
      this.activeConnections.add(ws);

      ws.on('message', async (data: Buffer) => {
        try {
          const request: MCPRequest = JSON.parse(data.toString());
          const response = await this.handleMCPRequest(request);
          ws.send(JSON.stringify(response));
        } catch (error) {
          this.logger.error('Error procesando mensaje MCP:', error);
          const errorResponse: MCPResponse = {
            id: 'unknown',
            error: {
              code: -1,
              message: error instanceof Error ? error.message : 'Error desconocido'
            },
            timestamp: Date.now()
          };
          ws.send(JSON.stringify(errorResponse));
        }
      });

      ws.on('close', () => {
        this.logger.info('Conexión MCP cerrada');
        this.activeConnections.delete(ws);
      });

      ws.on('error', (error) => {
        this.logger.error('Error en conexión WebSocket:', error);
        this.activeConnections.delete(ws);
      });
    });
  }

  /**
   * Registra todas las herramientas MCP disponibles
   */
  private registerTools(): void {
    // Herramienta para obtener datos de mercado
    this.registerTool({
      name: 'get_market_data',
      description: 'Obtiene datos de mercado en tiempo real para un símbolo',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          interval: { type: 'string', default: '5m' }
        },
        required: ['symbol']
      },
      handler: async (params) => {
        return await this.bybit.getMarketData(params.symbol, params.interval);
      }
    });

    // Herramienta para análisis técnico
    this.registerTool({
      name: 'analyze_technical',
      description: 'Realiza análisis técnico completo de un símbolo',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          period: { type: 'number', default: 14 }
        },
        required: ['symbol']
      },
      handler: async (params) => {
        const klines = await this.bybit.getKlines(params.symbol, '5m', 100);
        return await this.technical.analyze(klines, params.period);
      }
    });

    // Herramienta para predicción Kalman
    this.registerTool({
      name: 'kalman_predict',
      description: 'Genera predicción de precio usando filtro de Kalman',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          lookAhead: { type: 'number', default: 5 }
        },
        required: ['symbol']
      },
      handler: async (params) => {
        const klines = await this.bybit.getKlines(params.symbol, '5m', 50);
        return await this.kalman.predict(klines, params.lookAhead);
      }
    });

    // Herramienta para análisis de IA
    this.registerTool({
      name: 'ai_analysis',
      description: 'Solicita análisis completo de IA para trading',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          context: { type: 'string' }
        },
        required: ['symbol']
      },
      handler: async (params) => {
        // Obtener datos necesarios
        const marketData = await this.bybit.getMarketData(params.symbol);
        const klines = await this.bybit.getKlines(params.symbol, '5m', 100);
        const technical = await this.technical.analyze(klines);
        const kalman = await this.kalman.predict(klines);

        // Preparar prompt para Ollama
        const prompt = this.buildAIPrompt(marketData, technical, kalman, params.context);
        
        // Obtener análisis de IA
        return await this.ollama.analyze(prompt);
      }
    });

    // Herramienta para ejecutar trades
    this.registerTool({
      name: 'execute_trade',
      description: 'Ejecuta una orden de trading después de validación de riesgo',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          side: { type: 'string', enum: ['Buy', 'Sell'] },
          quantity: { type: 'number' },
          leverage: { type: 'number' },
          stopLoss: { type: 'number' },
          takeProfit: { type: 'number' }
        },
        required: ['symbol', 'side', 'quantity']
      },
      handler: async (params) => {
        // Validar riesgo antes de ejecutar
        const riskCheck = await this.riskManager.validateTrade(params);
        if (!riskCheck.approved) {
          throw new Error(`Trade rechazado: ${riskCheck.reason}`);
        }

        // Ejecutar trade
        return await this.bybit.executeTrade(params);
      }
    });

    // Herramienta para obtener posiciones activas
    this.registerTool({
      name: 'get_positions',
      description: 'Obtiene todas las posiciones activas',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }
        }
      },
      handler: async (params) => {
        return await this.bybit.getPositions(params.symbol);
      }
    });

    this.logger.info(`${this.tools.size} herramientas MCP registradas`);
  }

  /**
   * Registra una nueva herramienta MCP
   */
  private registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
    this.logger.debug(`Herramienta registrada: ${tool.name}`);
  }

  /**
   * Maneja una solicitud MCP
   */
  private async handleMCPRequest(request: MCPRequest): Promise<MCPResponse> {
    this.logger.debug(`Procesando solicitud MCP: ${request.method}`);

    try {
      switch (request.method) {
        case 'tools/list':
          return {
            id: request.id,
            result: {
              tools: Array.from(this.tools.values()).map(tool => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema
              }))
            },
            timestamp: Date.now()
          };

        case 'tools/call':
          const { name, arguments: args } = request.params;
          const tool = this.tools.get(name);
          
          if (!tool) {
            throw new Error(`Herramienta no encontrada: ${name}`);
          }

          const result = await tool.handler(args);
          
          return {
            id: request.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            },
            timestamp: Date.now()
          };

        default:
          throw new Error(`Método MCP no soportado: ${request.method}`);
      }
    } catch (error) {
      this.logger.error(`Error en solicitud MCP ${request.id}:`, error);
      return {
        id: request.id,
        error: {
          code: -1,
          message: error instanceof Error ? error.message : 'Error desconocido'
        },
        timestamp: Date.now()
      };
    }
  }

  /**
   * Construye el prompt para el análisis de IA
   */
  private buildAIPrompt(marketData: any, technical: any, kalman: any, context?: string): string {
    return `
Eres un trader experto con IA. Analiza la siguiente información de mercado y proporciona una decisión de trading:

DATOS DE MERCADO:
${JSON.stringify(marketData, null, 2)}

INDICADORES TÉCNICOS:
${JSON.stringify(technical, null, 2)}

PREDICCIÓN KALMAN:
${JSON.stringify(kalman, null, 2)}

CONTEXTO ADICIONAL: ${context || 'Ninguno'}

Proporciona tu análisis en el siguiente formato JSON:
{
  "decision": "BUY|SELL|HOLD",
  "confidence": 0.0-1.0,
  "reasoning": "Explicación detallada",
  "suggestedLeverage": 1-10,
  "riskLevel": "low|medium|high",
  "marketSentiment": "bullish|bearish|neutral"
}

Sé preciso, objetivo y considera todos los factores de riesgo.
    `;
  }

  /**
   * Broadcast a todas las conexiones activas
   */
  public broadcast(message: any): void {
    const data = JSON.stringify(message);
    this.activeConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
  }

  /**
   * Cierra el servidor
   */
  public async close(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => {
        this.server.close(() => {
          this.logger.info('Servidor MCP cerrado');
          resolve();
        });
      });
    });
  }
}
