import dotenv from 'dotenv';
import { MCPServer } from './mcp/server';
import { TradingStrategy } from './strategy/trading-strategy';
import { Logger } from './utils/logger';

// Cargar variables de entorno
dotenv.config();

/**
 * Punto de entrada principal del sistema de trading automatizado
 */
class TradingSystem {
  private logger: Logger;
  private mcpServer: MCPServer;
  private tradingStrategy: TradingStrategy;
  private isRunning: boolean = false;

  constructor() {
    this.logger = new Logger('TradingSystem');
    this.mcpServer = new MCPServer(parseInt(process.env.MCP_PORT || '3001'));
    this.tradingStrategy = new TradingStrategy();
  }

  /**
   * Inicia el sistema completo
   */
  async start(): Promise<void> {
    try {
      this.logger.system('TradingSystem', 'start');
      
      // Verificar variables de entorno
      this.validateEnvironment();
      
      // Iniciar servidor MCP
      this.logger.info('Iniciando servidor MCP...');
      // El servidor MCP ya se inicia automáticamente en el constructor
      
      // Iniciar estrategia de trading si está habilitada
      if (process.env.ENABLE_AUTO_TRADING === 'true') {
        const symbol = process.env.TRADING_SYMBOL || 'BTCUSDT';
        const interval = process.env.TRADING_INTERVAL || '5m';
        
        this.logger.info(`Iniciando estrategia de trading para ${symbol} (${interval})`);
        await this.tradingStrategy.start(symbol, interval);
      } else {
        this.logger.info('Trading automático deshabilitado');
      }

      this.isRunning = true;
      this.logger.info('Sistema de trading iniciado exitosamente');
      
      // Manejar señales de cierre
      this.setupGracefulShutdown();

    } catch (error) {
      this.logger.error('Error iniciando sistema:', error);
      process.exit(1);
    }
  }

  /**
   * Detiene el sistema
   */
  async stop(): Promise<void> {
    try {
      this.logger.system('TradingSystem', 'stop');
      this.isRunning = false;
      
      await this.tradingStrategy.stop();
      await this.mcpServer.close();
      
      this.logger.info('Sistema detenido exitosamente');
      process.exit(0);
    } catch (error) {
      this.logger.error('Error deteniendo sistema:', error);
      process.exit(1);
    }
  }

  /**
   * Valida las variables de entorno requeridas
   */
  private validateEnvironment(): void {
    const requiredVars = [
      'BYBIT_API_KEY',
      'BYBIT_API_SECRET',
      'OLLAMA_HOST'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      this.logger.error(`Variables de entorno faltantes: ${missingVars.join(', ')}`);
      throw new Error(`Variables de entorno requeridas: ${missingVars.join(', ')}`);
    }

    this.logger.info('Variables de entorno validadas correctamente');
  }

  /**
   * Configura el cierre graceful del sistema
   */
  private setupGracefulShutdown(): void {
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        this.logger.info(`Recibida señal ${signal}, iniciando cierre graceful...`);
        await this.stop();
      });
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('Excepción no capturada:', error);
      this.stop();
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Promesa rechazada no manejada:', { reason, promise });
    });
  }

  /**
   * Obtiene el estado del sistema
   */
  getStatus(): {
    isRunning: boolean;
    mcpPort: number;
    autoTrading: boolean;
    tradingSymbol?: string;
  } {
    return {
      isRunning: this.isRunning,
      mcpPort: parseInt(process.env.MCP_PORT || '3001'),
      autoTrading: process.env.ENABLE_AUTO_TRADING === 'true',
      tradingSymbol: process.env.TRADING_SYMBOL
    };
  }
}

// Crear e iniciar el sistema
const tradingSystem = new TradingSystem();

// Iniciar el sistema
tradingSystem.start().catch(error => {
  console.error('Error fatal iniciando sistema:', error);
  process.exit(1);
});

// Exportar para uso en otros módulos
export { TradingSystem };
export default tradingSystem;
