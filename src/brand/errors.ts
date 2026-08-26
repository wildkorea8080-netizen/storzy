export class DomainError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string) {
    super("NOT_FOUND", `${resource} was not found`);
  }
}

export class ConflictError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}

