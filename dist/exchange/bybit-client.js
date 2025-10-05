"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BybitClient = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
/**
 * Cliente para interactuar con la API de Bybit
 * Soporta trading de perpetuos con análisis en tiempo real
 */
class BybitClient {
    client;
    logger;
    config;
    // private wsConnection: any = null; // Para futuras implementaciones de WebSocket
    constructor() {
        this.logger = new logger_1.Logger('BybitClient');
        this.config = {
            apiKey: process.env.BYBIT_API_KEY || '',
            apiSecret: process.env.BYBIT_API_SECRET || '',
            testnet: process.env.BYBIT_TESTNET === 'true',
            baseUrl: process.env.BYBIT_TESTNET === 'true'
                ? 'https://api-demo.bybit.com'
                : 'https://api.bybit.com'
        };
        this.client = axios_1.default.create({
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
    async getMarketData(symbol, _interval = '5m') {
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
        }
        catch (error) {
            this.logger.error('Error obteniendo datos de mercado:', error);
            throw new Error(`Error obteniendo datos de mercado para ${symbol}`);
        }
    }
    /**
     * Obtiene velas (klines) históricas
     */
    async getKlines(symbol, interval, limit = 100) {
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
            const klines = response.data.result.list.map((kline) => ({
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
        }
        catch (error) {
            this.logger.error('Error obteniendo klines:', error);
            throw new Error(`Error obteniendo klines para ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Obtiene el Order Book (libro de órdenes) para análisis de liquidez y presión compra/venta
     */
    async getOrderBook(symbol, depth = 50) {
        try {
            const response = await this.client.get('/v5/market/orderbook', {
                params: {
                    category: 'linear',
                    symbol,
                    limit: depth
                }
            });
            if (!response.data.result) {
                throw new Error('No hay datos de order book en la respuesta');
            }
            const data = response.data.result;
            return {
                bids: data.b.map((bid) => ({
                    price: parseFloat(bid[0]),
                    quantity: parseFloat(bid[1])
                })),
                asks: data.a.map((ask) => ({
                    price: parseFloat(ask[0]),
                    quantity: parseFloat(ask[1])
                })),
                timestamp: parseInt(data.ts)
            };
        }
        catch (error) {
            this.logger.error('Error obteniendo order book:', error);
            throw new Error(`Error obteniendo order book para ${symbol}`);
        }
    }
    /**
     * Ejecuta una orden de trading
     */
    async executeTrade(params) {
        try {
            // Establecer leverage si se proporciona
            if (params.leverage) {
                await this.setLeverage(params.symbol, params.leverage);
            }
            // IMPORTANTE: El orden de las propiedades debe seguir la documentación de Bybit
            // Orden según docs: category, symbol, side, orderType, qty, timeInForce, stopLoss, takeProfit
            // FIX: Limpiar precisión de punto flotante (0.407000000000003 -> 0.407)
            const cleanQuantity = this.cleanFloatPrecision(params.quantity, 8);
            const orderData = {
                category: 'linear',
                symbol: params.symbol,
                side: params.side,
                orderType: 'Market',
                qty: cleanQuantity,
                timeInForce: 'IOC'
            };
            // Agregar Stop Loss y Take Profit si se proporcionan
            if (params.stopLoss) {
                orderData.stopLoss = this.cleanFloatPrecision(params.stopLoss, 2);
                orderData.slTriggerBy = 'LastPrice';
            }
            if (params.takeProfit) {
                orderData.takeProfit = this.cleanFloatPrecision(params.takeProfit, 2);
                orderData.tpTriggerBy = 'LastPrice';
            }
            this.logger.info(`Ejecutando orden: ${params.side} ${params.quantity} ${params.symbol}${params.stopLoss ? ` | SL: ${params.stopLoss}` : ''}${params.takeProfit ? ` | TP: ${params.takeProfit}` : ''}`);
            const response = await this.makeAuthenticatedRequest('/v5/order/create', orderData, 'POST');
            this.logger.info(`Orden ejecutada exitosamente: ${response.result.orderId}`);
            return {
                orderId: response.result.orderId,
                symbol: params.symbol,
                side: params.side,
                quantity: params.quantity,
                price: parseFloat(response.result.avgPrice || '0'),
                status: 'filled',
                timestamp: Date.now(),
                fees: parseFloat(response.result.cumExecFee || '0')
            };
        }
        catch (error) {
            this.logger.error('Error ejecutando trade:', error);
            throw new Error(`Error ejecutando trade: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }
    }
    /**
     * Obtiene posiciones activas
     */
    async getPositions(symbol) {
        try {
            const params = { category: 'linear' };
            if (symbol)
                params.symbol = symbol;
            // Usar el endpoint correcto según la documentación
            const response = await this.makeAuthenticatedRequest('/v5/position/list', params, 'GET');
            if (!response.result || !response.result.list) {
                this.logger.info('No hay posiciones activas');
                return [];
            }
            // Filtrar solo posiciones con size > 0 (posiciones realmente abiertas)
            const positions = response.result.list
                .filter((pos) => parseFloat(pos.size) > 0)
                .map((pos) => ({
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
            this.logger.info(`Posiciones activas encontradas: ${positions.length}`);
            return positions;
        }
        catch (error) {
            this.logger.error('Error obteniendo posiciones:', error);
            // Para demo trading, retornar array vacío si hay error
            this.logger.info('Asumiendo que no hay posiciones activas para demo trading');
            return [];
        }
    }
    /**
     * Establece el leverage para un símbolo
     */
    async setLeverage(symbol, leverage) {
        try {
            // IMPORTANTE: El orden de las propiedades debe coincidir con la documentación de Bybit
            const params = {
                category: 'linear',
                symbol: symbol,
                buyLeverage: leverage.toString(),
                sellLeverage: leverage.toString()
            };
            await this.makeAuthenticatedRequest('/v5/position/set-leverage', params, 'POST');
            this.logger.info(`Leverage establecido a ${leverage}x para ${symbol}`);
        }
        catch (error) {
            this.logger.error('Error estableciendo leverage:', error);
            // No lanzar error crítico, solo advertir - el trade puede continuar con leverage por defecto
            this.logger.warn(`Continuando sin cambiar leverage para ${symbol}`);
        }
    }
    /**
     * Obtiene el balance de la cuenta
     */
    async getBalance() {
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
            // Calcular balance total sumando todas las monedas en USD
            let totalBalanceUSD = 0;
            let usdtBalance = 0;
            if (account.coin && Array.isArray(account.coin)) {
                for (const coin of account.coin) {
                    const usdValue = parseFloat(coin.usdValue) || 0;
                    totalBalanceUSD += usdValue;
                    // Guardar balance USDT específicamente
                    if (coin.coin === 'USDT') {
                        usdtBalance = parseFloat(coin.walletBalance) || 0;
                    }
                }
            }
            // Usar el balance total de la cuenta unificada si está disponible
            const totalBalance = parseFloat(account.totalEquity) || totalBalanceUSD || 10000;
            // Para disponible, usar USDT disponible o un porcentaje del total
            const availableBalance = usdtBalance > 0 ? usdtBalance : totalBalance * 0.95;
            this.logger.info(`Balance obtenido - Total: $${totalBalance.toFixed(2)}, Disponible: $${availableBalance.toFixed(2)}`);
            return {
                totalBalance,
                availableBalance,
                usedMargin: parseFloat(account.totalPerpUPL) || 0
            };
        }
        catch (error) {
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
     * Actualiza el Stop Loss de una posición existente (para trailing stop)
     */
    async updatePositionStopLoss(symbol, stopLoss, takeProfit) {
        try {
            const params = {
                category: 'linear',
                symbol: symbol,
                stopLoss: stopLoss.toString(),
                slTriggerBy: 'LastPrice',
                positionIdx: 0 // 0 = one-way mode
            };
            // Agregar take profit si se proporciona
            if (takeProfit) {
                params.takeProfit = takeProfit.toString();
                params.tpTriggerBy = 'LastPrice';
            }
            await this.makeAuthenticatedRequest('/v5/position/trading-stop', params, 'POST');
            this.logger.info(`Stop Loss actualizado para ${symbol}: SL=${stopLoss}${takeProfit ? `, TP=${takeProfit}` : ''}`);
        }
        catch (error) {
            this.logger.error('Error actualizando stop loss:', error);
            throw new Error(`Error actualizando SL para ${symbol}`);
        }
    }
    /**
     * Obtiene el historial de órdenes ejecutadas
     */
    async getOrderHistory(symbol, limit = 50) {
        try {
            const params = {
                category: 'linear',
                symbol,
                orderStatus: 'Filled', // Solo órdenes ejecutadas
                limit
            };
            const response = await this.makeAuthenticatedRequest('/v5/order/history', params, 'GET');
            if (response.retCode !== 0) {
                this.logger.warn(`Error obteniendo historial de órdenes: ${response.retMsg}`);
                return [];
            }
            return response.result?.list || [];
        }
        catch (error) {
            this.logger.error('Error obteniendo historial de órdenes:', error);
            return [];
        }
    }
    /**
     * Verifica si hubo ejecuciones de TP/SL en las últimas órdenes
     */
    async checkTPSLExecutions(symbol, lastCheckTime) {
        try {
            const history = await this.getOrderHistory(symbol, 20);
            const recentOrders = history.filter((order) => {
                const orderTime = parseInt(order.updatedTime || order.createdTime);
                return orderTime > lastCheckTime;
            });
            const tpExecuted = recentOrders.some((order) => order.stopOrderType === 'TakeProfit' ||
                order.triggerBy === 'LastPrice' && parseFloat(order.triggerPrice) > 0);
            const slExecuted = recentOrders.some((order) => order.stopOrderType === 'StopLoss' ||
                (order.stopOrderType === 'Stop' && order.side !== order.positionIdx));
            if (recentOrders.length > 0) {
                this.logger.info(`📋 Órdenes recientes encontradas: ${recentOrders.length}`);
                recentOrders.forEach((order) => {
                    this.logger.debug(`  - ${order.side} ${order.qty} @ ${order.avgPrice} | Estado: ${order.orderStatus} | Tipo: ${order.stopOrderType || 'Market'}`);
                });
            }
            return {
                tpExecuted,
                slExecuted,
                orders: recentOrders
            };
        }
        catch (error) {
            this.logger.error('Error verificando ejecuciones TP/SL:', error);
            return { tpExecuted: false, slExecuted: false, orders: [] };
        }
    }
    /**
     * Cierra una posición específica (completa o parcial)
     */
    async closePosition(symbol, side, percentage = 100) {
        try {
            const positions = await this.getPositions(symbol);
            const position = positions.find(p => p.symbol === symbol && p.side === side);
            if (!position) {
                throw new Error(`No se encontró posición para cerrar: ${symbol} ${side}`);
            }
            // Obtener info del símbolo para respetar stepSize
            const symbolInfo = await this.getSymbolInfo(symbol);
            const closeSide = side === 'Buy' ? 'Sell' : 'Buy';
            const quantityRaw = (position.size * percentage) / 100;
            // Redondear según stepSize (CRÍTICO para ASTERUSDT y otros con stepSize = 1)
            const stepSize = symbolInfo.stepSize || 0.001;
            const quantityToClose = Math.floor(quantityRaw / stepSize) * stepSize;
            // Validar que la cantidad no sea 0
            if (quantityToClose <= 0) {
                this.logger.warn(`Cantidad calculada es 0 después de redondear. Raw: ${quantityRaw}, StepSize: ${stepSize}`);
                throw new Error(`Cantidad a cerrar es demasiado pequeña: ${quantityRaw}`);
            }
            this.logger.info(`Cerrando ${percentage}% de posición ${side} ${symbol}: ${quantityToClose} unidades (raw: ${quantityRaw.toFixed(4)}, stepSize: ${stepSize})`);
            return await this.executeTrade({
                symbol,
                side: closeSide,
                quantity: quantityToClose
            });
        }
        catch (error) {
            this.logger.error('Error cerrando posición:', error);
            throw new Error(`Error cerrando posición: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }
    }
    /**
     * Realiza una petición autenticada a la API
     */
    async makeAuthenticatedRequest(endpoint, params = {}, method = 'GET') {
        const timestamp = Date.now().toString();
        const recvWindow = '5000';
        // Para POST, usar JSON stringify; para GET, usar query string
        let signaturePayload;
        let sortedParams = params;
        if (method === 'POST') {
            // Para POST: NO ordenar, mantener el orden original del objeto
            // Bybit espera el JSON sin espacios en blanco
            signaturePayload = JSON.stringify(params);
        }
        else {
            // Para GET: ordenar alfabéticamente y usar el mismo orden para firma y request
            sortedParams = Object.keys(params)
                .sort()
                .reduce((acc, key) => {
                acc[key] = params[key];
                return acc;
            }, {});
            // Crear query string ordenado para la firma
            const stringParams = Object.keys(sortedParams).reduce((acc, key) => {
                acc[key] = String(sortedParams[key]);
                return acc;
            }, {});
            signaturePayload = new URLSearchParams(stringParams).toString();
        }
        // Crear firma según documentación de Bybit V5
        // Formato: timestamp + apiKey + recvWindow + signaturePayload
        const preSignString = timestamp + this.config.apiKey + recvWindow + signaturePayload;
        const signature = crypto_1.default
            .createHmac('sha256', this.config.apiSecret)
            .update(preSignString)
            .digest('hex');
        this.logger.debug(`Autenticación [${method}]: timestamp=${timestamp}`);
        this.logger.debug(`Signature payload: ${signaturePayload}`);
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
                // Usar los parámetros ordenados para el request también
                response = await this.client.get(endpoint, { params: sortedParams, headers });
            }
            else {
                response = await this.client.post(endpoint, params, { headers });
            }
            this.logger.debug(`Respuesta Bybit: ${JSON.stringify(response.data)}`);
            // Error codes que podemos ignorar
            const ignorableErrors = [
                110043, // leverage not modified - el leverage ya está configurado correctamente
            ];
            if (response.data.retCode !== 0 && !ignorableErrors.includes(response.data.retCode)) {
                throw new Error(`Error API Bybit: ${response.data.retMsg} (Code: ${response.data.retCode})`);
            }
            // Si es un error ignorable, solo loguear warning
            if (response.data.retCode !== 0 && ignorableErrors.includes(response.data.retCode)) {
                this.logger.warn(`Bybit warning (ignorado): ${response.data.retMsg} (Code: ${response.data.retCode})`);
            }
            return response.data;
        }
        catch (error) {
            this.logger.error('Error en petición autenticada:', {
                endpoint,
                params,
                method,
                error: error instanceof Error ? error.message : String(error),
                response: error instanceof Error ? error.response?.data : undefined
            });
            throw error;
        }
    }
    /**
     * Convierte intervalo de string a milisegundos
     */
    getIntervalMs(interval) {
        const intervals = {
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
    async healthCheck() {
        try {
            const response = await this.client.get('/v5/market/time');
            return response.data.retCode === 0;
        }
        catch (error) {
            this.logger.error('Health check de Bybit falló:', error);
            return false;
        }
    }
    /**
     * Obtiene información del símbolo
     */
    async getSymbolInfo(symbol) {
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
        }
        catch (error) {
            this.logger.error('Error obteniendo información del símbolo:', error);
            throw new Error(`Error obteniendo información de ${symbol}`);
        }
    }
    /**
     * Convierte intervalo a formato de Bybit
     */
    convertInterval(interval) {
        const intervals = {
            '1m': '1',
            '5m': '5',
            '15m': '15',
            '1h': '60',
            '4h': '240',
            '1d': 'D'
        };
        return intervals[interval] || '5';
    }
    /**
     * Limpia errores de precisión de punto flotante
     * Convierte 0.40700000000000003 -> "0.407"
     */
    cleanFloatPrecision(value, maxDecimals = 8) {
        // Redondear a maxDecimals y eliminar ceros innecesarios
        const rounded = Number(value.toFixed(maxDecimals));
        // Si es un entero, devolver sin decimales
        if (Number.isInteger(rounded)) {
            return rounded.toString();
        }
        // Convertir a string y eliminar ceros trailing
        let str = rounded.toFixed(maxDecimals);
        str = str.replace(/\.?0+$/, ''); // Elimina .000 o 0.4070000 -> 0.407
        return str;
    }
}
exports.BybitClient = BybitClient;
//# sourceMappingURL=bybit-client.js.map