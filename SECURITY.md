# Security

Each HTTP deployment has one administrator token with full browser access. Managed records have tenant scopes, but the dashboard has no per-user authorization. Automation modules and resolver policies execute trusted local code. Flow packs are constrained data, and their deployment manifests must still be reviewed by the operator. Exported profiles contain session data.

Keep the Engine API, CDP and VNC on the private worker network. Use a backend broker for client integrations instead of distributing the administrator token. A shared VNC desktop exposes every window on that display; database tenant scopes do not provide display isolation.

Keep credentials in environment variables or private inventory files. Managed input-vault keys, PostgreSQL data, browser profiles and archives belong in service-account storage. Flow journals and structured events exclude field values; trusted scripts remain responsible for their own file and network output. The repository ignores `.env`, runtime state, inventory credentials and `.kameleo` archives.

Report a vulnerability privately through GitHub's security reporting feature if enabled for this repository. If unavailable, contact the repository owner without posting credentials, affected session data or an exploit against a live user account in a public issue.
