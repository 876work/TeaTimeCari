const explicitDebugFlag = String(import.meta.env.VITE_ENABLE_DEBUG_LOGS || '').toLowerCase();

export const isDebugLoggingEnabled = import.meta.env.DEV || explicitDebugFlag === 'true';

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error' | 'debug';

function writeDebugLog(method: ConsoleMethod, args: unknown[]) {
  if (!isDebugLoggingEnabled) {
    return;
  }

  console[method](...args);
}

export function debugLog(...args: unknown[]) {
  writeDebugLog('log', args);
}

export function debugInfo(...args: unknown[]) {
  writeDebugLog('info', args);
}

export function debugWarn(...args: unknown[]) {
  writeDebugLog('warn', args);
}

export function debugError(...args: unknown[]) {
  writeDebugLog('error', args);
}

export function debugDebug(...args: unknown[]) {
  writeDebugLog('debug', args);
}
