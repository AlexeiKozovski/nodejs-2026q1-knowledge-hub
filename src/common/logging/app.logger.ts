import {
  ConsoleLogger,
  Injectable,
  LogLevel,
  LoggerService,
} from '@nestjs/common';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  log: 2,
  debug: 3,
  verbose: 4,
  fatal: 5,
};

const SUPPORTED_LEVELS: LogLevel[] = [
  'log',
  'debug',
  'warn',
  'error',
  'verbose',
];
const LOG_LEVELS_ASC: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];

function resolveLogLevel(value: string | undefined): LogLevel {
  if (!value) {
    return 'log';
  }
  return SUPPORTED_LEVELS.includes(value as LogLevel)
    ? (value as LogLevel)
    : 'log';
}

function buildEnabledLevels(minLevel: LogLevel): LogLevel[] {
  const minPriority = LOG_LEVEL_PRIORITY[minLevel];
  return LOG_LEVELS_ASC.filter(
    (level) => LOG_LEVEL_PRIORITY[level] <= minPriority,
  );
}

@Injectable()
export class AppLogger implements LoggerService {
  private readonly isProduction = process.env.NODE_ENV === 'production';
  private readonly minLevel = resolveLogLevel(process.env.LOG_LEVEL);
  private readonly enabledLevels = new Set(buildEnabledLevels(this.minLevel));
  private readonly devLogger = new ConsoleLogger(undefined, {
    logLevels: buildEnabledLevels(this.minLevel),
    timestamp: true,
  });

  log(message: unknown, context?: string): void {
    if (!this.enabledLevels.has('log')) return;
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    if (!this.enabledLevels.has('error')) return;
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    if (!this.enabledLevels.has('warn')) return;
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    if (!this.enabledLevels.has('debug')) return;
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    if (!this.enabledLevels.has('verbose')) return;
    this.write('verbose', message, context);
  }

  private write(
    level: Exclude<LogLevel, 'fatal'>,
    message: unknown,
    context?: string,
    trace?: string,
  ): void {
    if (this.isProduction) {
      const payload: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        level,
        context: context ?? 'Application',
        message,
      };
      if (trace) {
        payload.trace = trace;
      }
      process.stdout.write(`${JSON.stringify(payload)}\n`);
      return;
    }

    if (level === 'error') {
      this.devLogger.error(message, trace, context);
      return;
    }
    this.devLogger[level](message as never, context);
  }
}
