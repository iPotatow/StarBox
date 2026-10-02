export const MCP_READ_TOOLS = ["search_repositories", "get_repository", "get_repository_readme", "list_categories", "list_subscriptions", "get_releases"] as const;
export type McpToken = {
  id: string;
  name: string;
  writeMetadata: boolean;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
};
export type McpConnections = { endpoint: string; tokens: McpToken[] };
export type McpTokenCreated = { token: string; connection: McpToken };
