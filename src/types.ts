export type ThemeMode = "system" | "light" | "dark";
export type AccentMode = "neutral" | "blue" | "violet" | "emerald";
export type UiLanguage = "zh-CN" | "en";
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

export interface AiSettings {
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  headers: Record<string, string>;
  credentialConfigured?: boolean;
}

export type AiProtocol = "openai-compatible" | "anthropic-messages" | "google-gemini";
export interface AiModelOption { id: string; remoteModelId: string; displayName: string; enabled: boolean; sortOrder: number; }
export interface AiService { id: string; name: string; protocol: AiProtocol; baseUrl: string; enabled: boolean; credentialConfigured: boolean; models: AiModelOption[]; }
export interface AiServicesState { defaultModelId: string | null; services: AiService[]; }

export interface AppSettings {
  githubToken: string;
  githubIdentity: GithubIdentity | null;
  credentialConnected: boolean;
  theme: ThemeMode;
  accent: AccentMode;
  language: UiLanguage;
  hiddenNav: NavigationPageId[];
  batchUnstarEnabled: boolean;
  ai: AiSettings;
}

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

export interface ReleaseSettings {
  latestOnly: boolean;
  includePrereleases: boolean;
  assetRules: ReleaseAssetRules;
  pageSize: number;
  syncPages: number;
}

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

export interface PersistedState {
  version: 5;
  settings: AppSettings;
  repositories: Repository[];
  repositoryMeta: Record<string, RepositoryMeta>;
  categories: CategoryDefinition[];
  releaseSubscriptions: string[];
  releases: ReleaseItem[];
  releaseAiSummaries?: Record<string, LatestReleaseAiSummary>;
  releaseSettings: ReleaseSettings;
  forkJobs: ForkJob[];
  notifications: NotificationItem[];
  lastSyncAt: string | null;
  lastReleaseSyncAt: string | null;
  lastForkSyncAt: string | null;
  lastSeq?: number;
  lastBootstrapAt?: string | null;
}

export interface AiAnalysisMeta { inputHash: string; promptVersion: string; modelId: string; }
export type AiOrganizeResult =
  | { unchanged: true; platforms: string[]; analysisMeta: AiAnalysisMeta }
  | { unchanged?: false; summary: string; category: string; tags: string[]; platforms: string[]; analysisMeta: AiAnalysisMeta };
export interface RepositoryReadme { content: string; htmlUrl: string; }
export interface DiscoverResult { repositories: Repository[]; query: string; }

/** Functional updates preserve edits made while async work is pending. */
export type StateChange = (update: PersistedState | ((current: PersistedState) => PersistedState)) => void;
