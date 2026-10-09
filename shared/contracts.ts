/** Wire/domain types shared by browser and Worker. No UI or storage dependencies. */
export type ThemeMode = "system" | "light" | "dark";

export type AccentMode = "neutral" | "blue" | "violet" | "emerald";

export type UiLanguage = "zh-CN" | "zh-TW" | "en";

export type NavigationPageId = "repositories" | "releases" | "forks" | "discover" | "settings";

export interface Repository {
  id: number;
  node_id?: string;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage?: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count?: number;
  open_issues_count?: number;
  size?: number;
  default_branch?: string;
  visibility?: string;
  language: string | null;
  license: string | null;
  updated_at: string;
  pushed_at: string;
  starred_at: string | null;
  archived: boolean;
  fork?: boolean;
  topics: string[];
  owner: { login: string; avatar_url: string };
}

export interface RepositoryMeta {
  category: string;
  categoryLocked?: boolean;
  note: string;
  aiSummary: string;
  aiTags: string[];
  aiPlatforms: string[];
  userRevision?: number;
  aiAnalyzedAt?: string | null;
  aiInputHash?: string;
  aiPromptVersion?: string;
  aiModelId?: string;
}

export interface CategoryDefinition {
  id: string;
  name: string;
  color: string;
  order: number;
  locked: boolean;
}

export type AiProtocol = "openai-compatible" | "anthropic-messages" | "google-gemini";
export type AiHeaderPreset = "codex-desktop-latest" | "codex-cli";

export interface AiModelOption { id: string; remoteModelId: string; displayName: string; enabled: boolean; sortOrder: number; }

export interface AiService { headerPreset?: AiHeaderPreset | null; id: string; name: string; protocol: AiProtocol; baseUrl: string; enabled: boolean; credentialConfigured: boolean; models: AiModelOption[]; }

export interface AiServicesState { defaultModelId: string | null; services: AiService[]; }

export interface GithubIdentity {
  id?: number;
  login: string;
  avatarUrl?: string;
  connectedAt?: string;
}

export interface AuthSession {
  authenticated: boolean;
  username?: string;
  githubIdentity?: GithubIdentity | null;
  defaultCredentialsActive?: boolean;
  deviceId?: string | null;
}

export interface LoginDevice {
  id: string;
  name: string;
  type: "desktop" | "mobile" | "tablet" | string;
  os: string;
  browser: string;
  browserVersion?: string | null;
  osVersion?: string | null;
  ipAddress: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  href?: string;
}

export interface AiReleaseSummary { overview: string; highlights: string[]; fixes: string[]; breakingChanges: string[]; }

export interface LatestReleaseAiSummary {
  repoFullName: string;
  releaseId: number;
  tagName: string;
  summary: AiReleaseSummary;
  modelId: string;
  generatedAt: string;
}

export interface ReleaseItem {
  id: number;
  repoFullName: string;
  tagName: string;
  name: string;
  body: string;
  htmlUrl: string;
  publishedAt: string | null;
  createdAt: string;
  draft: boolean;
  prerelease: boolean;
  author: { login: string; avatarUrl: string } | null;
  assets: Array<{ id: number; name: string; size: number; downloadCount: number; browserDownloadUrl: string }>;
  /** @deprecated Release AI summaries are D1-backed in LatestReleaseAiSummary. */
  aiSummary?: AiReleaseSummary;
}

export type ReleaseAssetPlatform = "macos" | "windows" | "linux";

export interface ReleaseAssetRule { includePattern: string; excludePattern: string; }

export type ReleaseAssetRules = Record<ReleaseAssetPlatform, ReleaseAssetRule>;

export type ForkStatus = "pending" | "ready" | "failed";

export interface ForkJob {
  id: string;
  sourceFullName: string;
  targetOwner: string;
  targetName: string;
  targetFullName: string;
  htmlUrl: string | null;
  status: ForkStatus;
  createdAt: string;
  updatedAt: string;
  error: string;
  pollAttempts?: number;
  nextPollAt?: string | null;
  snapshot?: ForkRepository;
}

export interface WorkflowSummary {
  id: number;
  workflowId: number;
  name: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: string;
}

export interface WorkflowDefinition {
  id: number;
  name: string;
  path: string;
  state: string;
}

export interface ForkRepository {
  id: number;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  defaultBranch: string;
  pushedAt: string;
  owner: { login: string; avatarUrl: string };
  parentFullName: string | null;
  parentHtmlUrl: string | null;
  aheadBy: number | null;
  behindBy: number | null;
  compareStatus: string;
  latestWorkflow: WorkflowSummary | null;
  workflows: WorkflowDefinition[];
}

export interface GithubRateLimit {
  limit: number;
  remaining: number;
  used: number;
  resetAt: string;
  resource: string;
}

export interface AiAnalysisMeta { inputHash: string; promptVersion: string; modelId: string; }

export type AiOrganizeResult =
  | { unchanged: true; platforms: string[]; analysisMeta: AiAnalysisMeta }
  | { unchanged?: false; summary: string; category: string; tags: string[]; platforms: string[]; analysisMeta: AiAnalysisMeta };

export type RepositoryReadmeLanguage = "default" | UiLanguage;

export interface RepositoryReadmeOption { language: RepositoryReadmeLanguage; path: string; }

export interface RepositoryReadme { content: string; htmlUrl: string; path: string; language: RepositoryReadmeLanguage; availableLanguages: RepositoryReadmeOption[]; }

export interface DiscoverResult { repositories: Repository[]; query: string; }

export interface ProviderConfig {
  providerName: string;
  protocol?: AiProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  headers?: Record<string, string>;
  headerPreset?: AiHeaderPreset | null;
}

export type MutationOperation =
  | "category.create" | "category.update" | "category.rename" | "category.delete" | "category.reorder"
  | "repository_meta.update" | "repository_meta.ai" | "repository_meta.ai_batch" | "repository_meta.batch_category"
  | "release.subscribe" | "release.unsubscribe" | "release.subscribe.batch"
  | "fork.save" | "fork.update" | "unstar" | "star.unstar" | "star.unstarBatch";

export interface MutationRequest {
  id: string;
  operation: string;
  payload: unknown;
  baseRevision?: string;
}
export interface MutationResponse<State = unknown> {
  revision: number | string;
  cursor?: string;
  state?: Partial<State>;
  userRevisions?: Record<string, number>;
}
export interface ApiErrorPayload {
  error: string | { code?: string; message?: string; details?: unknown };
  diagnostics?: string;
}
export interface ReleaseFeedResponse { releases: ReleaseItem[]; failures: Array<{ fullName: string; error: string }>; }
export interface ForkListResponse { forks: ForkRepository[]; complete: boolean; }
export interface AiConfigResponse { providerName: string; baseUrl: string; model: string; credentialConfigured: boolean; updatedAt?: string | null; }
export interface PreferencesResponse {
  syncPages: number;
  assetRules: ReleaseAssetRules;
  theme: ThemeMode;
  accent: AccentMode;
  language: UiLanguage;
  hiddenNav: NavigationPageId[];
  batchUnstarEnabled: boolean;
  includePrereleases: boolean;
}
export type PreferencePatch = Partial<Omit<PreferencesResponse, "assetRules">> & {
  assetRules?: Partial<Record<ReleaseAssetPlatform, Partial<ReleaseAssetRule>>>;
  assetIncludePattern?: string;
  assetExcludePattern?: string;
};

/** Bootstrap returns DB snapshots; browser cache models remain client-owned. */
export interface BootstrapPayload<State = unknown> {
  account?: Record<string, unknown> | null;
  githubCredential?: Record<string, unknown> | null;
  repositories?: Record<string, unknown>[];
  repositoryMeta?: Record<string, unknown>[];
  categories?: Record<string, unknown>[];
  releaseSubscriptions?: Array<string | Record<string, unknown>>;
  releaseAiSummaries?: Record<string, unknown>[];
  forks?: Record<string, unknown>[];
  notifications?: Record<string, unknown>[];
  aiCredential?: Record<string, unknown> | null;
  appPreferences?: Record<string, unknown> | null;
  syncSummary?: Record<string, unknown> | null;
  revision?: number | string;
  lastSeq?: number | string;
  cursor?: string | null;
  state?: State;
  delta?: Partial<State>;
}
