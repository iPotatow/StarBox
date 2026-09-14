export type D1Result<T = Record<string, unknown>> = { success?: boolean; meta?: Record<string, unknown>; results?: T[] };
export type D1PreparedStatement = { bind(...values: unknown[]): D1PreparedStatement; first<T = Record<string, unknown>>(column?: string): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<D1Result<T>>; run(): Promise<D1Result>; };
export type D1Database = { prepare(query: string): D1PreparedStatement; batch(statements: D1PreparedStatement[]): Promise<D1Result[]>; };
export type LoginRateLimiter = { limit(input: { key: string }): Promise<{ success: boolean }> };
export type StarBoxEnv = { DB?: D1Database; ASSETS?: { fetch(request: Request): Promise<Response> }; LOGIN_USERNAME?: string; LOGIN_PASSWORD?: string; SESSION_TTL_SECONDS?: string; LOGIN_RATE_LIMITER?: LoginRateLimiter; GITHUB_TOKEN_ENCRYPTION_KEY?: string; GITHUB_TOKEN_ENCRYPTION_KEY_PREVIOUS?: string; GITHUB_TOKEN_ENCRYPTION_KEY_OLD?: string; GITHUB_TOKEN_ENCRYPTION_KEY_VERSION?: string; STARBOX_CREDENTIAL_ENCRYPTION_KEY?: string; STARBOX_CREDENTIAL_ENCRYPTION_KEY_PREVIOUS?: string; STARBOX_CREDENTIAL_ENCRYPTION_KEY_VERSION?: string; };
export const PRIMARY_ACCOUNT_ID = "primary" as const;
export type AccountRecord = { account_id: string; github_user_id: string | null; github_login: string | null; revision: number; created_at: string; updated_at: string };
export type SessionRecord = {
  token_hash: string; account_id: string; created_at: string; expires_at: string; last_seen_at: string; revoked_at: string | null;
  device_id: string | null; device_name: string | null; device_type: string | null; os: string | null; browser: string | null;
  ip_address: string | null; country_code: string | null; region: string | null; city: string | null; user_agent: string | null;
};
export type GithubCredentialRecord = { account_id: string; github_numeric_id: string; github_login: string; ciphertext: string; iv: string; key_version: string; fingerprint: string; validated_at: string; created_at: string; updated_at: string; status: string };
export type Identity = { accountId: typeof PRIMARY_ACCOUNT_ID; session: SessionRecord };

export type AiCredentialRecord = { account_id: string; ciphertext: string; iv: string; key_version: string; fingerprint: string; created_at: string; updated_at: string; status: string };
export type AiProtocol = "openai-compatible" | "anthropic-messages" | "google-gemini";
export type AiServiceRecord = { service_id: string; account_id: string; name: string; protocol: AiProtocol; base_url: string; enabled: number; config_json: string; created_at: string; updated_at: string };
export type AiServiceCredentialRecord = { service_id: string; account_id: string; ciphertext: string; iv: string; key_version: string; fingerprint: string; created_at: string; updated_at: string; status: string };
export type AiModelRecord = { model_id: string; account_id: string; service_id: string; remote_model_id: string; display_name: string; enabled: number; sort_order: number; created_at: string; updated_at: string };
export type AiTaskBindingRecord = { account_id: string; task: string; model_id: string; updated_at: string };
export type AppPreferencesRecord = { account_id: string; ai_provider_name: string; ai_base_url: string; ai_model: string; release_sync_pages: number; release_asset_include_pattern: string; release_asset_exclude_pattern: string; updated_at: string };
