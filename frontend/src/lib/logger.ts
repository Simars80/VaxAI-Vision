type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel =
  (import.meta.env.VITE_LOG_LEVEL as LogLevel | undefined) ??
  (import.meta.env.DEV ? "debug" : "warn");

function log(level: LogLevel, context: string, message: string, data?: unknown): void {
  if (LEVELS[level] < LEVELS[MIN_LEVEL]) return;
  const entry = { level, context, message, ...(data !== undefined ? { data } : {}) };
  const methods: Record<LogLevel, typeof console.log> = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };
  methods[level](`[${context}]`, message, ...(data !== undefined ? [data] : []));
  if (import.meta.env.PROD) {
    // In production, structured entries can be shipped to an APM sink.
    // For now we suppress them from the console (already done above via MIN_LEVEL).
    void entry;
  }
}

export function createLogger(context: string) {
  return {
    debug: (message: string, data?: unknown) => log("debug", context, message, data),
    info: (message: string, data?: unknown) => log("info", context, message, data),
    warn: (message: string, data?: unknown) => log("warn", context, message, data),
    error: (message: string, data?: unknown) => log("error", context, message, data),
  };
}
