# TrackWeaving MCP Server

TrackWeaving exposes a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server so AI assistants (Cursor, Claude, ChatGPT, Windsurf, etc.) can query **read-only** workspace data using **OAuth 2.1** with PKCE (S256), dynamic client registration, refresh tokens, and token revocation.

Inspired by hosted MCP patterns such as [Pulsetic MCP](https://pulsetic.com/mcp/).

## Prerequisites

1. Install MCP runtime dependencies once:

```bash
cd trackweaving-mcp && npm install
```

2. Backend environment (`.env`):

| Variable | Description |
|----------|-------------|
| `MCP_ENABLED` | Set to `false` to disable MCP (default: enabled) |
| `MCP_PUBLIC_BASE_URL` | Public URL of your API, e.g. `https://api.yourdomain.com` |
| `MCP_HTTP_PATH` | MCP endpoint path (default: `/mcp`) |
| `MCP_OAUTH_ISSUER_URL` | OAuth issuer URL (default: `MCP_PUBLIC_BASE_URL`) |
| `MCP_STRICT_RESOURCE` | RFC 8707 resource binding (default: `true`) |

For local HTTP development only:

```bash
MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL=true
```

## Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST/GET/DELETE /mcp` | Streamable HTTP MCP transport |
| `/.well-known/oauth-authorization-server` | OAuth AS metadata (RFC 8414) |
| `/.well-known/oauth-protected-resource/mcp` | Protected resource metadata (RFC 9728) |
| `/register` | Dynamic client registration (RFC 7591) |
| `/authorize` | Authorization (PKCE required) |
| `/token` | Token endpoint |
| `/revoke` | Token revocation |
| `/oauth/consent` | TrackWeaving login + consent |

## REST API (same data as MCP tool)

`POST /api/v1/machine-logs/details` (Bearer JWT from web app)

Body:

```json
{
  "startDate": "2026-01-01",
  "endDate": "2026-01-31",
  "machineIds": ["optional"],
  "shift": [0, 1],
  "quality": "optional",
  "operatorId": "optional",
  "machineGroupId": "optional",
  "page": 1,
  "limit": 50
}
```

Returns historical logs with `stopsData` enriched using `getStopReason` / status code mapping.

## Cursor configuration

OAuth (ChatGPT-style) example:

```json
{
  "mcpServers": {
    "trackweaving": {
      "type": "streamableHttp",
      "url": "https://api.yourdomain.com/mcp"
    }
  }
}
```

Cursor will discover OAuth metadata from `/.well-known/oauth-protected-resource/mcp` and walk through dynamic registration + browser login.

## MCP tools (read-only)

- `list_machines`, `list_machine_groups`, `get_machine_group`
- `list_operators`, `list_machine_log_qualities`
- `list_live_machine_logs`
- `get_machine_logs_details` (historical logs + stop reasons)
- `get_production_report`, `get_quality_production_report`, `get_stoppage_report`
- `list_users`, `get_access_matrix`
- `list_maintenance_categories`, `list_part_change_logs`
- `get_alert_config` (workspace owner)

Write/update/delete tools will be added in a later phase.

## Security notes

- PKCE S256 is mandatory for authorization codes.
- Access tokens are stored hashed at rest; refresh token rotation revokes prior access rows.
- MongoDB TTL indexes expire authorization codes and tokens.
- Rate limits apply to OAuth authorize/consent routes (via MCP SDK + consent router).
- MCP scope is limited to `mcp:read`; workspace RBAC still applies per tool.
