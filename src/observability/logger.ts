export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Readonly<Record<string, unknown>>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

const LEVEL_WEIGHT: Readonly<Record<LogLevel, number>> = { debug: 10, info: 20, warn: 30, error: 40 };

function safeError(error: unknown): unknown {
  if (!(error instanceof Error)) return error;
  return { name: error.name, message: error.message, stack: error.stack };
}

export class JsonLogger implements Logger {
  constructor(
    private readonly minimumLevel: LogLevel = "info",
    private readonly baseFields: LogFields = {},
    private readonly write: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
  ) {}

  debug(message: string, fields?: LogFields): void {
    this.log("debug", message, fields);
  }
  info(message: string, fields?: LogFields): void {
    this.log("info", message, fields);
  }
  warn(message: string, fields?: LogFields): void {
    this.log("warn", message, fields);
  }
  error(message: string, fields?: LogFields): void {
    this.log("error", message, fields);
  }
  child(fields: LogFields): Logger {
    return new JsonLogger(this.minimumLevel, { ...this.baseFields, ...fields }, this.write);
  }

  private log(level: LogLevel, message: string, fields: LogFields = {}): void {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.minimumLevel]) return;
    const normalizedFields = Object.fromEntries(
      Object.entries({ ...this.baseFields, ...fields }).map(([key, value]) => [key, key === "error" ? safeError(value) : value]),
    );
    this.write(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...normalizedFields }));
  }
}

export class NoopLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  child(): Logger {
    return this;
  }
}

