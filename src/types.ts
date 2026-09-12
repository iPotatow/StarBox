export type ThemeMode = "system" | "light" | "dark";
export type DensityMode = "comfortable" | "compact";
export type AccentMode = "neutral" | "blue" | "violet" | "emerald";
export type NavigationPageId = "repositories" | "releases" | "forks" | "lists" | "discover" | "activity" | "notifications" | "settings";

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
  note: string;
  aiSummary: string;
  aiTags: string[];
  pinned: boolean;
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
}

export interface AppSettings {
  githubToken: string;
  githubIdentity: GithubIdentity | null;
  credentialConnected: boolean;
  theme: ThemeMode;
  density: DensityMode;
  accent: AccentMode;
  navOrder: NavigationPageId[];
  hiddenNav: NavigationPageId[];
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
}

export interface ActivityItem {
  id: string;
  action: string;
  summary: string;
  createdAt: string;
  metadata?: Record<string, string>;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  href?: string;
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
}

export interface ReleaseState { read: boolean; updatedAt: string; }
export interface ReleaseSettings {
  latestOnly: boolean;
  includePrereleases: boolean;
  assetIncludePattern: string;
  assetExcludePattern: string;
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
}

export interface WorkflowSummary {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: string;
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
}

export interface GithubListItem { id: string; fullName: string; htmlUrl: string; }
export interface GithubStarList {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  items: GithubListItem[];
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
  releaseStates: Record<string, ReleaseState>;
  releaseSettings: ReleaseSettings;
  forkJobs: ForkJob[];
  forkReadAt: Record<string, string>;
  githubLists: GithubStarList[];
  activity: ActivityItem[];
  notifications: NotificationItem[];
  lastSyncAt: string | null;
  lastReleaseSyncAt: string | null;
  lastListSyncAt: string | null;
  lastSeq?: number;
  lastBootstrapAt?: string | null;
}

export interface AiOrganizeResult { summary: string; category: string; tags: string[]; }
export interface RepositoryReadme { content: string; htmlUrl: string; }
export interface DiscoverResult { repositories: Repository[]; query: string; }
