/**
 * Structured logging (P5-05). Deliberately no third-party log SDK: every
 * line is one JSON object on stdout/stderr, which every host (Vercel, a
 * container platform, `journalctl`, ...) already captures and can index —
 * that's the "structured logging" requirement without adding a vendor.
 */

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogContext {
  [key: string]: unknown
}

function write(level: LogLevel, message: string, context?: LogContext): void {
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...(context ? { context } : {}),
  })
  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

export const logger = {
  info: (message: string, context?: LogContext) =>
    write('info', message, context),
  warn: (message: string, context?: LogContext) =>
    write('warn', message, context),
  error: (message: string, context?: LogContext) =>
    write('error', message, context),
}
