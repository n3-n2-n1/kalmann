"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const winston = __importStar(require("winston"));
/**
 * Sistema de logging centralizado con Winston
 * Proporciona logging estructurado para todo el sistema
 */
class Logger {
    winston;
    module;
    constructor(module) {
        this.module = module;
        this.winston = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
            defaultMeta: { module },
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(winston.format.colorize(), winston.format.simple())
                }),
                new winston.transports.File({
                    filename: 'logs/error.log',
                    level: 'error',
                    maxsize: 5242880, // 5MB
                    maxFiles: 5
                }),
                new winston.transports.File({
                    filename: 'logs/combined.log',
                    maxsize: 5242880, // 5MB
                    maxFiles: 5
                })
            ]
        });
    }
    /**
     * Log de información
     */
    info(message, data) {
        this.winston.info(message, data);
    }
    /**
     * Log de debug
     */
    debug(message, data) {
        this.winston.debug(message, data);
    }
    /**
     * Log de advertencia
     */
    warn(message, data) {
        this.winston.warn(message, data);
    }
    /**
     * Log de error
     */
    error(message, error) {
        this.winston.error(message, { error: error?.stack || error });
    }
    /**
     * Log estructurado para trading
     */
    trade(action, data) {
        this.winston.info(`TRADE_${action.toUpperCase()}`, {
            ...data,
            timestamp: data.timestamp || Date.now()
        });
    }
    /**
     * Log de análisis de IA
     */
    aiAnalysis(data) {
        this.winston.info('AI_ANALYSIS', {
            ...data,
            timestamp: Date.now()
        });
    }
    /**
     * Log de riesgo
     */
    risk(level, message, data) {
        this.winston.warn(`RISK_${level.toUpperCase()}: ${message}`, data);
    }
    /**
     * Log de sistema
     */
    system(component, status, data) {
        this.winston.info(`SYSTEM_${component.toUpperCase()}_${status.toUpperCase()}`, {
            component,
            status,
            ...data,
            timestamp: Date.now()
        });
    }
    /**
     * Log de métricas
     */
    metrics(metrics) {
        this.winston.info('METRICS', {
            ...metrics,
            timestamp: Date.now()
        });
    }
    /**
     * Crea un log entry estructurado
     */
    createLogEntry(level, message, data) {
        return {
            level,
            message,
            timestamp: Date.now(),
            module: this.module,
            data
        };
    }
    /**
     * Obtiene logs recientes
     */
    async getRecentLogs(_limit = 100) {
        // Esta implementación sería más compleja en producción
        // Por ahora retornamos un array vacío
        return [];
    }
    /**
     * Limpia logs antiguos
     */
    async cleanOldLogs(daysToKeep = 7) {
        this.winston.info(`Limpiando logs más antiguos que ${daysToKeep} días`);
        // Implementación de limpieza de logs
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map