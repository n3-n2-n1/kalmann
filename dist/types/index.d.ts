/**
 * Tipos principales para el sistema de trading con IA
 */
export interface MarketData {
    symbol: string;
    price: number;
    volume: number;
    timestamp: number;
    high24h: number;
    low24h: number;
    change24h: number;
    bid: number;
    ask: number;
}
export interface Kline {
    openTime: number;
    closeTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
export interface TechnicalIndicators {
    rsi: number;
    macd: {
        macd: number;
        signal: number;
        histogram: number;
    };
    bollinger: {
        upper: number;
        middle: number;
        lower: number;
    };
    ema: {
        ema9: number;
        ema21: number;
        ema50: number;
    };
    volume: {
        avg: number;
        current: number;
        ratio: number;
    };
}
export interface KalmanPrediction {
    predictedPrice: number;
    confidence: number;
    trend: 'bullish' | 'bearish' | 'neutral';
    timeframe: string;
    accuracy: number;
}
export interface AIAnalysis {
    decision: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    reasoning: string;
    indicators: TechnicalIndicators;
    kalman: KalmanPrediction;
    marketSentiment: 'bullish' | 'bearish' | 'neutral';
    riskLevel: 'low' | 'medium' | 'high';
    suggestedLeverage: number;
}
export interface TradeSignal {
    symbol: string;
    action: 'BUY' | 'SELL' | 'CLOSE';
    leverage: number;
    quantity: number;
    stopLoss?: number;
    takeProfit?: number;
    timestamp: number;
    aiAnalysis: AIAnalysis;
}
export interface Position {
    symbol: string;
    side: 'Buy' | 'Sell';
    size: number;
    entryPrice: number;
    currentPrice: number;
    pnl: number;
    pnlPercentage: number;
    leverage: number;
    timestamp: number;
}
export interface TradeResult {
    orderId: string;
    symbol: string;
    side: 'Buy' | 'Sell';
    quantity: number;
    price: number;
    status: 'filled' | 'partial' | 'cancelled' | 'rejected';
    timestamp: number;
    fees: number;
}
export interface TradingConfig {
    symbol: string;
    maxLeverage: number;
    maxPositionSize: number;
    riskPercentage: number;
    stopLossPercentage: number;
    takeProfitPercentage: number;
    enablePaperTrading: boolean;
    maxDailyTrades: number;
}
export interface BybitConfig {
    apiKey: string;
    apiSecret: string;
    testnet: boolean;
    baseUrl: string;
}
export interface OllamaConfig {
    host: string;
    model: string;
    timeout: number;
}
export interface MCPRequest {
    id: string;
    method: string;
    params: any;
    timestamp: number;
}
export interface MCPResponse {
    id: string;
    result?: any;
    error?: {
        code: number;
        message: string;
    };
    timestamp: number;
}
export interface MCPTool {
    name: string;
    description: string;
    inputSchema: any;
    handler: (params: any) => Promise<any>;
}
export interface SystemHealth {
    status: 'healthy' | 'warning' | 'error';
    uptime: number;
    memoryUsage: number;
    activeConnections: number;
    lastTradeTime: number;
    errorCount: number;
}
export interface LogEntry {
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    timestamp: number;
    module: string;
    data?: any;
}
export interface PositionTracking {
    symbol: string;
    side: 'Buy' | 'Sell';
    entryPrice: number;
    entryTime: number;
    maxPriceReached: number;
    minPriceReached: number;
    trailingStopActive: boolean;
    currentStopLoss: number;
    currentTakeProfit: number;
    lastUpdateTime: number;
    profitLadderExecuted: number[];
}
export interface ExitStrategy {
    name: string;
    triggered: boolean;
    score: number;
    reason: string;
    action: 'CLOSE_100' | 'CLOSE_50' | 'CLOSE_25' | 'UPDATE_SL' | 'HOLD';
}
export interface PositionAnalysis {
    position: Position;
    timeInPosition: number;
    unrealizedPnL: number;
    unrealizedPnLPercentage: number;
    analysis: {
        ai: AIAnalysis;
        technical: TechnicalIndicators;
        kalman: KalmanPrediction;
    };
    trailingStop: {
        active: boolean;
        maxPriceReached: number;
        currentSL: number;
        shouldUpdate: boolean;
        newSL?: number;
    };
    exitStrategies: ExitStrategy[];
    recommendation: {
        action: 'HOLD' | 'CLOSE_FULL' | 'CLOSE_PARTIAL' | 'UPDATE_TRAILING';
        percentage?: number;
        reasons: string[];
        confidence: number;
    };
}
//# sourceMappingURL=index.d.ts.map