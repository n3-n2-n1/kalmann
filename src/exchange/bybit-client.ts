import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { MarketData, Kline, Position, TradeResult, BybitConfig } from '../types';
import { Logger } from '../utils/logger';

/**
 * Cliente para interactuar con la API de Bybit
 * Soporta trading de perpetuos con análisis en tiempo real
 */
export class BybitClient {
  private client: AxiosInstance;
  private logger: Logger;
  private config: BybitConfig;
  // private wsConnection: any = null; // Para futuras implementaciones de WebSocket

  constructor() {
    this.logger = new Logger('BybitClient');
    this.config = {
      apiKey: process.env.BYBIT_API_KEY || '',
      apiSecret: process.env.BYBIT_API_SECRET || '',
      testnet: process.env.BYBIT_TESTNET === 'true',
      baseUrl: process.env.BYBIT_TESTNET === 'true' 
        ? 'https://api-demo.bybit.com' 
        : 'https://api.bybit.com'
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.logger.info(`Cliente Bybit inicializado - Testnet: ${this.config.testnet}`);
  }

  /**
   * Obtiene datos de mercado en tiempo real
   */
  async getMarketData(symbol: string, _interval: string = '5m'): Promise<MarketData> {
    try {
      const response = await this.client.get('/v5/market/tickers', {
        params: { category: 'linear', symbol }
      });

      const data = response.data.result.list[0];
      
      return {
        symbol: data.symbol,
        price: parseFloat(data.lastPrice),
        volume: parseFloat(data.volume24h),
        timestamp: Date.now(),
        high24h: parseFloat(data.highPrice24h),
        low24h: parseFloat(data.lowPrice24h),
        change24h: parseFloat(data.price24hPcnt) * 100,
        bid: parseFloat(data.bid1Price),
        ask: parseFloat(data.ask1Price)
      };
    } catch (error) {
      this.logger.error('Error obteniendo datos de mercado:', error);
      throw new Error(`Error obteniendo datos de mercado para ${symbol}`);
    }
  }

  /**
   * Obtiene velas (klines) históricas
   */
  async getKlines(symbol: string, interval: string, limit: number = 100): Promise<Kline[]> {
    try {
      this.logger.debug(`Obteniendo velas para ${symbol}, intervalo: ${interval}, límite: ${limit}`);
      
      const response = await this.client.get('/v5/market/kline', {
        params: {
          category: 'linear',
          symbol,
          interval: this.convertInterval(interval),
          limit
        }
      });

      this.logger.debug('Respuesta de Bybit:', JSON.stringify(response.data, null, 2));

      if (!response.data.result || !response.data.result.list) {
        this.logger.warn('No hay datos de velas en la respuesta');
        return [];
      }

      const klines = response.data.result.list.map((kline: any) => ({
        openTime: parseInt(kline[0]),
        closeTime: parseInt(kline[0]) + this.getIntervalMs(interval),
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5])
      })).reverse(); // Ordenar cronológicamente

      this.logger.info(`Velas obtenidas: ${klines.length} para ${symbol}`);
      return klines;
    } catch (error) {
      this.logger.error('Error obteniendo klines:', error);
      throw new Error(`Error obteniendo klines para ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Ejecuta una orden de trading
   */
  async executeTrade(params: {
    symbol: string;
    side: 'Buy' | 'Sell';
    quantity: number;
    leverage?: number;
    stopLoss?: number;
    takeProfit?: number;
  }): Promise<TradeResult> {
    try {
      // Establecer leverage si se proporciona
      if (params.leverage) {
        await this.setLeverage(params.symbol, params.leverage);
      }

      const orderData = {
        category: 'linear',
        symbol: params.symbol,
        side: params.side,
        orderType: 'Market',
        qty: params.quantity.toString(),
        timeInForce: 'IOC'
      };

      const response = await this.makeAuthenticatedRequest('/v5/order/create', orderData);
      
      return {
        orderId: response.result.orderId,
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity,
        price: parseFloat(response.result.avgPrice),
        status: 'filled',
        timestamp: Date.now(),
        fees: parseFloat(response.result.cumExecFee)
      };
    } catch (error) {
      this.logger.error('Error ejecutando trade:', error);
      throw new Error(`Error ejecutando trade: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Obtiene posiciones activas
   */
  async getPositions(symbol?: string): Promise<Position[]> {
    try {
      const params: any = { category: 'linear' };
      if (symbol) params.symbol = symbol;

      // Usar el endpoint correcto según la documentación
      const response = await this.makeAuthenticatedRequest('/v5/position/list', params, 'GET');
      
      if (!response.result || !response.result.list) {
        this.logger.info('No hay posiciones activas');
        return [];
      }
      
      return response.result.list.map((pos: any) => ({
        symbol: pos.symbol,
        side: pos.side,
        size: parseFloat(pos.size),
        entryPrice: parseFloat(pos.avgPrice),
        currentPrice: parseFloat(pos.markPrice),
        pnl: parseFloat(pos.unrealisedPnl),
        pnlPercentage: parseFloat(pos.unrealisedPnl) / (parseFloat(pos.avgPrice) * parseFloat(pos.size)) * 100,
        leverage: parseFloat(pos.leverage),
        timestamp: Date.now()
      }));
    } catch (error) {
      this.logger.error('Error obteniendo posiciones:', error);
      // Para demo trading, retornar array vacío si hay error
      this.logger.info('Asumiendo que no hay posiciones activas para demo trading');
      return [];
    }
  }

  /**
   * Establece el leverage para un símbolo
   */
  async setLeverage(symbol: string, leverage: number): Promise<void> {
    try {
      await this.makeAuthenticatedRequest('/v5/position/set-leverage', {
        category: 'linear',
        symbol,
        buyLeverage: leverage.toString(),
        sellLeverage: leverage.toString()
      });
      
      this.logger.info(`Leverage establecido a ${leverage}x para ${symbol}`);
    } catch (error) {
      this.logger.error('Error estableciendo leverage:', error);
      throw new Error(`Error estableciendo leverage para ${symbol}`);
    }
  }

  /**
   * Obtiene el balance de la cuenta
   */
  async getBalance(): Promise<{
    totalBalance: number;
    availableBalance: number;
    usedMargin: number;
  }> {
    try {
      const response = await this.makeAuthenticatedRequest('/v5/account/wallet-balance', {
        accountType: 'UNIFIED'
      }, 'GET');

      if (!response.result || !response.result.list || response.result.list.length === 0) {
        this.logger.info('No hay datos de balance, usando valores demo');
        return {
          totalBalance: 10000, // Balance demo
          availableBalance: 10000,
          usedMargin: 0
        };
      }

      const account = response.result.list[0];
      
      return {
        totalBalance: parseFloat(account.totalWalletBalance),
        availableBalance: parseFloat(account.totalAvailableBalance),
        usedMargin: parseFloat(account.totalPerpUPL)
      };
    } catch (error) {
      this.logger.error('Error obteniendo balance:', error);
      this.logger.info('Usando balance demo para trading');
      return {
        totalBalance: 10000, // Balance demo
        availableBalance: 10000,
        usedMargin: 0
      };
    }
  }

  /**
   * Cierra una posición específica
   */
  async closePosition(symbol: string, side: 'Buy' | 'Sell'): Promise<TradeResult> {
    try {
      const positions = await this.getPositions(symbol);
      const position = positions.find(p => p.symbol === symbol && p.side === side);
      
      if (!position) {
        throw new Error(`No se encontró posición para cerrar: ${symbol} ${side}`);
      }

      const closeSide = side === 'Buy' ? 'Sell' : 'Buy';
      
      return await this.executeTrade({
        symbol,
        side: closeSide,
        quantity: position.size
      });
    } catch (error) {
      this.logger.error('Error cerrando posición:', error);
      throw new Error(`Error cerrando posición: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Realiza una petición autenticada a la API
   */
  private async makeAuthenticatedRequest(endpoint: string, params: any = {}, method: 'GET' | 'POST' = 'GET'): Promise<any> {
    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    
    // Crear query string para firma
    const queryString = new URLSearchParams(params).toString();
    
    // Crear firma según documentación de Bybit
    const signature = crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(timestamp + this.config.apiKey + recvWindow + queryString)
      .digest('hex');

    this.logger.debug(`Autenticación: timestamp=${timestamp}, query=${queryString}, signature=${signature}`);

    const headers = {
      'X-BAPI-API-KEY': this.config.apiKey,
      'X-BAPI-SIGN': signature,
      'X-BAPI-SIGN-TYPE': '2',
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': recvWindow,
      'Content-Type': 'application/json'
    };

    let response;
    try {
      if (method === 'GET') {
        response = await this.client.get(endpoint, { params, headers });
      } else {
        response = await this.client.post(endpoint, params, { headers });
      }

      this.logger.debug(`Respuesta Bybit: ${JSON.stringify(response.data)}`);

      if (response.data.retCode !== 0) {
        throw new Error(`Error API Bybit: ${response.data.retMsg} (Code: ${response.data.retCode})`);
      }

      return response.data;
    } catch (error) {
      this.logger.error('Error en petición autenticada:', {
        endpoint,
        params,
        method,
        error: error instanceof Error ? error.message : String(error),
        response: error instanceof Error ? (error as any).response?.data : undefined
      });
      throw error;
    }
  }

  /**
   * Convierte intervalo de string a milisegundos
   */
  private getIntervalMs(interval: string): number {
    const intervals: { [key: string]: number } = {
      '1m': 60 * 1000,
      '3m': 3 * 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '2h': 2 * 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    
    return intervals[interval] || 5 * 60 * 1000; // Default 5m
  }

  /**
   * Verifica la conexión con Bybit
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/v5/market/time');
      return response.data.retCode === 0;
    } catch (error) {
      this.logger.error('Health check de Bybit falló:', error);
      return false;
    }
  }

  /**
   * Obtiene información del símbolo
   */
  async getSymbolInfo(symbol: string): Promise<{
    symbol: string;
    baseCoin: string;
    quoteCoin: string;
    minOrderQty: number;
    maxOrderQty: number;
    tickSize: number;
    stepSize: number;
  }> {
    try {
      const response = await this.client.get('/v5/market/instruments-info', {
        params: { category: 'linear', symbol }
      });

      const info = response.data.result.list[0];
      
      return {
        symbol: info.symbol,
        baseCoin: info.baseCoin,
        quoteCoin: info.quoteCoin,
        minOrderQty: parseFloat(info.lotSizeFilter.minOrderQty),
        maxOrderQty: parseFloat(info.lotSizeFilter.maxOrderQty),
        tickSize: parseFloat(info.priceFilter.tickSize),
        stepSize: parseFloat(info.lotSizeFilter.qtyStep)
      };
    } catch (error) {
      this.logger.error('Error obteniendo información del símbolo:', error);
      throw new Error(`Error obteniendo información de ${symbol}`);
    }
  }

  /**
   * Convierte intervalo a formato de Bybit
   */
  private convertInterval(interval: string): string {
    const intervals: { [key: string]: string } = {
      '1m': '1',
      '5m': '5',
      '15m': '15',
      '1h': '60',
      '4h': '240',
      '1d': 'D'
    };
    return intervals[interval] || '5';
  }
}
