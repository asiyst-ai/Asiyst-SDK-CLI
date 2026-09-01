export { Asiyst } from "./client/Asiyst";
export { SDK_VERSION } from "./core/constants";
export {
  AsiystError,
  ConfigurationError,
  AuthenticationError,
  InitializationError,
  TargetNotFoundError,
  ActionNotAllowedError,
  NetworkError,
  TaskExecutionError,
} from "./errors";
export { TaskStatus, canTransition } from "./task/states";
export { fallbackConfig, normalizeProjectConfig, validateInitOptions } from "./config/schema";
export { isSafeSelector } from "./security/selectors";
export { sanitizeText } from "./security/sanitize";
export { computeAvatarDestination, anchorToViewport } from "./utils/geometry";
export { canNavigateTo, evaluateActionPermission, isActionAllowed, validateWebsiteDomain } from "./interaction/permissions";

export type {
  InitOptions,
  ProjectConfig,
  TargetInput,
  TargetRef,
  TaskDefinition,
  TaskStep,
  WorkflowDefinition,
  ActionKind,
  AssistantMode,
  HighlightStyle,
  WebsiteMapSnapshot,
  MappedElement,
} from "./types";
export type { AsiystEventMap, AsiystEventName } from "./events/types";
