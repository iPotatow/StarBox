// Compatibility exports for existing consumers; implementation lives in domain modules.
export { handlePreferences } from "./preferences.js";
export { hydrateGithubToken, handleGithubCredential } from "./routes/credentials.js";
export { handleSync, handleBootstrap, handleSyncMutation, handleNotifications } from "./routes/sync.js";
export { loadAiProviderConfig, handleAiConfig } from "./routes/ai-config.js";
