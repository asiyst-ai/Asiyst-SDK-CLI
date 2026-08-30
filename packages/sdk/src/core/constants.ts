declare const __ASIYST_SDK_VERSION__: string | undefined;

export const SDK_VERSION = typeof __ASIYST_SDK_VERSION__ === "string" && __ASIYST_SDK_VERSION__
  ? __ASIYST_SDK_VERSION__
  : "0.1.6";
export const DEFAULT_API_BASE_URL = "https://nqhxpgsjofzqudyqkqib.supabase.co/functions/v1/api";
export const CONFIG_SCHEMA_VERSION = 1;
export const HOST_ELEMENT_ID = "asiyst-host";
export const DATA_ATTR = "data-asiyst";
export const DATA_ATTR_DESCRIPTION = "data-asiyst-description";
export const STORAGE_PREFIX = "asiyst";
export const ANALYTICS_FLUSH_INTERVAL_MS = 4000;
export const ANALYTICS_BATCH_SIZE = 12;
export const DOM_SCAN_DEBOUNCE_MS = 350;
export const VIEWPORT_HANDLER_THROTTLE_MS = 80;
export const AVATAR_VIEWPORT_PADDING = 12;
export const AVATAR_TARGET_GAP = 16;
export const TEXT_MATCH_MAX_LENGTH = 240;
export const WEBSITE_MAP_TEXT_LIMIT = 80;
export const CONFIG_CACHE_TTL_MS = 1000 * 60 * 10;
