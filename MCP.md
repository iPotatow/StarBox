# StarBox MCP

StarBox exposes your saved GitHub collection to MCP clients at `https://your-starbox-domain/mcp`. It uses the official TypeScript MCP SDK with stateless Streamable HTTP and JSON responses. No separate server or database migration is required.

## Connect an assistant

1. Deploy this version of StarBox and sign in. Sync your Stars; connect GitHub for live README and Release queries.
2. Open **Settings → MCP** (`/settings?tab=mcp`). Create a named connection with a 7, 30, or 90 day expiry. Connections are read-only by default.
3. Copy the token while it is visible. Copy the configuration example or enter the endpoint and `Authorization: Bearer <token>` header in your client.
4. Use **Test connection** to check the actual MCP endpoint. Save the token in your client, then hide it in StarBox.

Example for clients accepting `mcpServers` JSON:

```json
{
  "mcpServers": {
    "starbox": {
      "url": "https://your-starbox-domain/mcp",
      "headers": { "Authorization": "Bearer <STARBOX_MCP_TOKEN>" }
    }
  }
}
```

Client configuration formats vary. This release requires a client that supports custom Bearer headers; OAuth-only clients are not supported. It does not implement a legacy SSE endpoint or a persistent GET notification stream. Each request uses the token, so changed permissions and revoked connections take effect on subsequent requests without reconnecting.

## Tools

| Tool | Behavior |
| --- | --- |
| `search_repositories` | Search starred repositories by name, description, notes, AI summaries, categories and tags. Filter by language, category (`null` = uncategorized) or exact tag. `limit` ≤ 50; continue using `nextOffset`. |
| `get_repository` | Read saved details, notes, category, tags, saved Release AI summary, freshness timestamps and `user_revision`. |
| `get_repository_readme` | Fetch the default, Chinese or English README live from GitHub. `maxChars` ≤ 30,000; continue using `nextOffset`. |
| `list_categories` | Read category names and stable IDs. |
| `list_subscriptions` | Paginate saved Release subscriptions, including repositories not currently starred. |
| `get_releases` | Fetch live releases and installation assets for a saved repository. `limit` ≤ 10; use `nextPage`, `bodyOffset` and `nextBodyOffset` for longer histories/changelogs. Prerelease filtering applies to each fetched page; an empty filtered page may still have `nextPage`. |
| `update_repository_metadata` | Available only with **Allow collection edits** enabled. Modify supplied notes, category or tags. Requires `expectedUserRevision`; assigning a category locks it against automatic AI recategorization. `categoryId: null` clears the category and lock. |

Example requests to your assistant:

- “Find React animation libraries in my saved collection and compare my notes.”
- “Which projects in my subscriptions have new releases? Link the source for each change.”
- “Propose categories for my uncategorized repositories, show me the changes, and apply the ones I approve.”

Collection search uses the existing synced D1 snapshot. Results include `synced_at` and `retrievedAt`; searching does not implicitly sync GitHub. README and Release tools fetch independently of browser caches, using the encrypted GitHub credential stored in StarBox. They only accept repositories already saved in StarBox.

Metadata edits reuse the same atomic SQL revision guard as the web editor. Read `user_revision` with `get_repository`, present the proposed changes, and pass that revision as `expectedUserRevision`. On `revision_conflict`, reread the repository and review the proposal again. The proposal/approval instruction is guidance to the assistant; StarBox enforces connection permissions and revision guards, but does not create a separate approval queue. Web views pick up external edits on the next Bootstrap/reload; open drafts retain their version and will report conflicts.

## Connection management

Each connection has a separate random 256-bit token. Only its SHA-256 hash and metadata are persisted in namespaced settings rows; raw tokens cannot be retrieved after creation. The existing eight-table database schema is unchanged, and tokens are excluded from public preferences and Bootstrap responses.

Settings lists connection expiry and last-use time (updated at most once per minute). Enable or disable collection edits per connection, or revoke it permanently and create a replacement. Expired tokens cannot be used. Logging out of the web UI does not revoke independent MCP connections.

The MCP route does not accept web session cookies or browser-supplied GitHub credentials as authentication. It rejects foreign Origin headers, limits incoming bodies to 64 KiB, and uses a separate configured Cloudflare rate limiter (120 requests per token per minute). Live GitHub calls retain the existing outbound time and size limits. README and changelog content is marked as untrusted reference material.

## Development and validation

`npm run check` includes real MCP SDK client tests against the production route and real SQLite schema. They cover initialize/tool calls, search/pagination, token management, authorization changes, expiry/revocation, revision conflicts, request limits, and encrypted-credential README/Release queries with mocked GitHub responses.

`npm run dev` is a static preview; `/api/*` and `/mcp` return 501. For the actual Cloudflare runtime, build the UI and use `wrangler dev` with local D1 and local login/encryption configuration. A Worker dry-run confirms bundling, not production connectivity. Deployment and live client compatibility require separate verification.
