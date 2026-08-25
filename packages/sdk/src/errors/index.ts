export class AsiystError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AsiystError";
    this.code = code;
  }
}

export class ConfigurationError extends AsiystError {
  constructor(message: string) {
    super("configuration_error", message);
    this.name = "ConfigurationError";
  }
}

export class AuthenticationError extends AsiystError {
  constructor(message: string) {
    super("authentication_error", message);
    this.name = "AuthenticationError";
  }
}

export class InitializationError extends AsiystError {
  constructor(message: string) {
    super("initialization_error", message);
    this.name = "InitializationError";
  }
}

export class TargetNotFoundError extends AsiystError {
  constructor(message: string) {
    super("target_not_found", message);
    this.name = "TargetNotFoundError";
  }
}

export class ActionNotAllowedError extends AsiystError {
  constructor(message: string) {
    super("action_not_allowed", message);
    this.name = "ActionNotAllowedError";
  }
}

export class NetworkError extends AsiystError {
  constructor(message: string) {
    super("network_error", message);
    this.name = "NetworkError";
  }
}

export class TaskExecutionError extends AsiystError {
  constructor(message: string) {
    super("task_execution_error", message);
    this.name = "TaskExecutionError";
  }
}
