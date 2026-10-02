import type { ThemeMode, AccentMode, UiLanguage, NavigationPageId, Repository, RepositoryMeta, CategoryDefinition, AiProtocol, AiModelOption, AiService, AiServicesState, GithubIdentity, AuthSession, LoginDevice, NotificationItem, AiReleaseSummary, LatestReleaseAiSummary, ReleaseItem, ReleaseAssetPlatform, ReleaseAssetRule, ReleaseAssetRules, ForkStatus, ForkJob, WorkflowSummary, WorkflowDefinition, ForkRepository, GithubRateLimit, AiAnalysisMeta, AiOrganizeResult, RepositoryReadmeLanguage, RepositoryReadmeOption, RepositoryReadme, DiscoverResult } from "../shared/contracts.js";
export type { ThemeMode, AccentMode, UiLanguage, NavigationPageId, Repository, RepositoryMeta, CategoryDefinition, AiProtocol, AiModelOption, AiService, AiServicesState, GithubIdentity, AuthSession, LoginDevice, NotificationItem, AiReleaseSummary, LatestReleaseAiSummary, ReleaseItem, ReleaseAssetPlatform, ReleaseAssetRule, ReleaseAssetRules, ForkStatus, ForkJob, WorkflowSummary, WorkflowDefinition, ForkRepository, GithubRateLimit, AiAnalysisMeta, AiOrganizeResult, RepositoryReadmeLanguage, RepositoryReadmeOption, RepositoryReadme, DiscoverResult } from "../shared/contracts.js";

export interface AiSettings {
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  headers: Record<string, string>;
  credentialConfigured?: boolean;
}

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

export interface ReleaseSettings {
  latestOnly: boolean;
  includePrereleases: boolean;
  assetRules: ReleaseAssetRules;
  pageSize: number;
  syncPages: number;
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

export type StateChange = (update: PersistedState | ((current: PersistedState) => PersistedState)) => void;
