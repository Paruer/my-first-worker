# Codex context: tabletop gaming applications

## Purpose and priorities

Build small browser applications for tabletop gaming with friends. Optimize for readable code, rapid iteration between gaming sessions, inexpensive hosting, and easy local development. Some applications are static reference tools; others need persistence and live collaboration. Add infrastructure only when a feature needs it.

This document records the agreed architecture. It does not assert that repositories, packages, scripts, bindings, or interfaces have already been created. Inspect the current repository before implementing anything. Treat the directory layouts below as starting conventions, and preserve established equivalents when they work.

## Repository and deployment boundaries

- Each application has its own Git repository, subdomain, deployment configuration, and release lifecycle. An application can be replaced or retired without redeploying the others.
- `cloudflare-platform` is the shared infrastructure repository, organized as a pnpm workspace. It owns reusable packages, development conventions, scaffolding, and reusable GitHub Actions workflows.
- Share code aggressively when useful, including UI components, validation, authentication, persistence utilities, transport utilities, and tooling. Intentional coupling through versioned packages is welcome; do not impose a policy that applications must avoid shared code.
- Application repositories consume published versions from GitHub Packages. They are not folders in a mandatory all-applications monorepo. A platform release does not automatically upgrade or redeploy consumers.
- Keep application-specific rules and data ownership in the application repository. Do not read another application's database or import its private source tree.
- Keep resources separate per application and environment unless a shared resource is explicitly designed and documented.

## Agreed stack

| Concern | Default |
| --- | --- |
| Browser UI | Svelte 5 and TypeScript |
| Development and builds | Vite with the Cloudflare Vite plugin |
| Runtime and assets | Cloudflare Workers and Workers Static Assets |
| Relational persistence | Cloudflare D1 (SQLite) with Drizzle ORM |
| Flexible structured data | JSON, validated with Zod |
| Live collaboration | Durable Objects and WebSockets |
| Authentication | Cloudflare Access, with JWT verification in the Worker |
| Authorization | Application-owned permissions, checked server-side |
| Shared code | Versioned packages in GitHub Packages, developed in `cloudflare-platform` |
| Automation | GitHub Actions, including reusable platform workflows |
| Cloudflare tooling | Wrangler |
| Testing | Vitest, plus Workers-runtime integration tests where needed |
| Package management | pnpm with a committed lockfile |

Use Svelte 5 conventions for new UI code, small components, and strict TypeScript. Do not introduce SvelteKit, another backend framework, a separate application server, or a second deployment platform without a concrete requirement. Static-only applications need no database or Durable Object.

Vite provides the development server, frontend compilation, hot reload, and production build. The Cloudflare plugin runs Worker code in the local Workers runtime and integrates bindings. GitHub Actions invokes repository scripts; Vite is not the deployment scheduler. Wrangler manages Cloudflare configuration, migrations, secrets, and deployment.

## Domain rules stay independent

Game rules must not know how they are displayed, persisted, or transmitted.

- Keep domain models, invariants, calculations, and state transitions in plain TypeScript. No Svelte, DOM, HTTP, WebSocket, Cloudflare, Drizzle, or database imports in domain code.
- Application use cases coordinate domain behavior and define the small ports they need. Infrastructure adapters implement persistence, identity verification, and transport.
- UI components render state and issue commands. Workers and Durable Objects validate requests, authorize actions, and invoke use cases. Do not duplicate rules across those entry points.
- Pass time, randomness, and external dependencies explicitly when they affect rules. Server-authoritative outcomes must not trust browser calculations.
- Keep transport schemas and storage mappings at their boundaries. A pure shared Zod schema is acceptable when it models a domain value without importing infrastructure.

Suggested application layout, not an existing scaffold:

```text
src/
  domain/          # Models, rules, pure state transitions
  application/     # Use cases and required ports
  infrastructure/  # D1/Drizzle, Access, Durable Object adapters
  worker/          # HTTP routing and runtime composition
  ui/              # Svelte components and browser entry point
migrations/        # Reviewed D1 SQL migrations
tests/             # Cross-boundary and runtime tests
```

Colocate focused unit tests if that matches the repository. Preserve the dependency direction even when the file layout differs. Do not build elaborate generic abstractions before they solve an actual problem.

## Separating TypeSript from implementation

- As much as is reasonable, separate TypeScript type and interface definitions from business code.
- This separation can be done as appropriate for the use case. For larger application it might make sense to have a "models" folder with separate ts files for each domain. For a type used for convenience in one function, it might make sense for it to live in the file where it is used. A middle ground might be a single "types.ts" file that defines the interfaces and types needed for the application.
- We can decide the approach on a case-by-case basis but the bias should be toward separation so that business logic is easily found within our files.

## D1, Drizzle, JSON, and Zod

- Use Drizzle's D1 adapter and typed schema for relational reads and writes. Keep SQL and persistence details behind adapters.
- Use columns and constraints for identifiers, ownership, relations, uniqueness, and frequently queried fields. Use JSON for evolving nested game data that does not need relational modeling.
- Validate external input and decoded stored JSON with Zod. TypeScript types alone provide no runtime validation. Version persisted JSON structures when their shape evolves and provide an explicit upgrade path.
- Generate, inspect, commit, and test migrations. Use one documented migration history and runner; do not independently apply the same migration through multiple tools.
- Apply migrations to local state first and staging before production. Confirm the target environment and database before remote operations.
- Use D1-supported atomic operations where required; do not assume a generic SQLite transaction API works in D1. Design concurrent writes with constraints, conditional updates, or version checks.
- Prefer backward-compatible schema evolution. Document recovery and data backup/export steps before destructive changes. Application rollback does not reverse a database migration.

## Durable Objects and real-time behavior

- Use a Durable Object as the authoritative coordinator for a shared room, table, or session when serialized collaboration is needed. Derive object identity server-side within the application and environment namespace.
- Authenticate and authorize the WebSocket upgrade and every command. A successful connection is not permission to mutate arbitrary rooms or entities.
- Validate messages with explicit schemas; include a protocol version and command identifiers where retries can duplicate effects. Bound payload sizes and message rates.
- Treat the server as authoritative. Broadcast accepted changes; clients reconcile optimistic UI with server state. Provide reconnect and snapshot/resynchronization behavior with revision tracking.
- Decide and document which data is canonical in Durable Object storage versus D1. Avoid uncoordinated dual writes and do not treat memory or open sockets as durable storage. Where both stores participate, define retry and reconciliation behavior.
- Await durable writes before acknowledging durable outcomes. Do not assume serialization eliminates interleaving across asynchronous operations.
- Prefer WebSocket hibernation where appropriate. Reconstruct required connection context after wake-up; do not rely on in-memory state surviving.
- Define how session expiry and revoked membership affect long-lived connections. Do not let an authenticated socket grant indefinite access.

## Access, authorization, and security

Cloudflare Access controls who can enter an application. The application controls what that identity can do.

- Protect each intended hostname with Access policies. Verify the `Cf-Access-Jwt-Assertion` token in the Worker using a maintained JWT library, the configured team's trusted signing keys, expected issuer, application audience, allowed algorithm, and time claims. Handle key rotation through supported JWKS caching.
- Never trust a decoded-but-unverified JWT, a caller-provided user ID, or an email header alone. Derive identity from verified claims; use a stable subject for membership records.
- Check membership, ownership, and role permissions for each protected resource and mutation. Deny by default. Keep these checks in application use cases so HTTP and real-time paths enforce the same policy.
- Restrict or disable alternate entry points, including `workers.dev` and preview URLs, so they cannot bypass protection. Verify routing for API paths and WebSocket upgrades as well as browser pages.
- Static assets can be served before Worker code. When assets require Worker authorization, configure routing to run the Worker first; do not assume API middleware protects asset delivery. Keep sensitive data out of public build assets.
- Prefer same-origin API and WebSocket URLs within each app subdomain. Validate request origin for cookie-authenticated mutations and WebSocket upgrades; apply CSRF protection where appropriate. If cross-origin access is required, allow explicit trusted origins.
- Keep database bindings, Access verification settings, and secrets server-side. Anything exposed through `VITE_*` or bundled into browser code is public.
- Store runtime secrets through Wrangler/Cloudflare and CI secrets in GitHub's secret storage. Commit only safe templates. Never commit tokens, private credentials, or local secret files, and never log JWTs or authorization headers.
- Use parameterized queries, bounded input, safe error responses, and appropriate browser security headers. Do not place private response data in shared public caches.

## Shared packages and platform workspace

Before importing shared functionality, inspect the platform's actual package manifests, exports, documentation, and published versions. Proposed package names and example APIs are not dependencies that can be assumed to exist.

The platform workspace may contain packages for UI, authentication, persistence helpers, real-time protocols, schemas, and configuration. Choose names and public interfaces when implementing them. Keep browser-safe exports separate from server-only exports so importing UI utilities cannot bundle secrets or Cloudflare bindings.

- Publish scoped, built packages to GitHub Packages with semantic versions, explicit exports, and TypeScript declarations. Document compatibility and breaking changes.
- Use `workspace:` dependencies inside `cloudflare-platform` where appropriate. Independently deployed app repositories use published versions and lockfiles, never unresolved workspace links or sibling-directory source imports.
- Keep workflows in `.github/workflows/` and document their `workflow_call` inputs, outputs, and required secrets. Pin consumers to reviewed immutable revisions where practical.
- Configure the actual package scope for `npm.pkg.github.com`. Commit registry configuration with environment-variable token references only, never token values.
- In CI, use `GITHUB_TOKEN` with the required package permissions and explicitly grant consuming repositories package access. For local installs, use the supported GitHub authentication method with minimum required package-read permissions. Do not assume access to one repository grants access to every package.
- Support documented local package iteration through builds and packed artifacts or another explicit override mechanism. Confirm published package contents also work before release.

## Local development contract

A developer should be able to clone one application and work without deploying the platform or running every application.

1. Follow the repository's Node and pnpm versions; install using its committed lockfile and configure package-read authentication.
2. Copy the documented local configuration template and supply only the values that feature needs. Keep local secrets ignored.
3. Initialize local D1 state, apply migrations, and load safe, repeatable seed data through documented scripts.
4. Start Vite with the Cloudflare plugin so UI, Worker routes, bindings, and WebSockets can be exercised together. Use local D1 and Durable Objects by default; remote resources require an explicit choice and environment.
5. Use a local-only identity adapter with representative users and permissions when Access is unavailable locally. Select it through a development-only entry/configuration and fail closed if it is selected in a deployed environment. Exercise real Access in staging.

Create and document repository scripts for development, type checking, linting, tests, build, local migrations, seeding, and deployment when scaffolding. These are required capabilities, not assertions about existing script names. Use existing scripts when present. Make local state persistence and reset behavior explicit; never make a local reset target a remote database.

Keep Wrangler configuration version-controlled with explicit environment bindings, compatibility date, routes, and Durable Object migration tags as needed. Generate Worker binding types from configuration. Keep credentials out of configuration and avoid Node-only APIs in runtime code unless supported compatibility is deliberately enabled.

## Testing and delivery

- Use Vitest for focused domain and application tests, including rule edge cases and authorization failures. These tests should run without Cloudflare credentials.
- Test D1 adapters, migrations, binding configuration, and Durable Object behavior in an appropriate Workers runtime. Include representative reconnect, duplicate-command, and invalid-message cases when changing real-time behavior.
- Run Svelte/TypeScript checking, linting, relevant tests, and a production build before delivery. Verify a fresh local database can migrate successfully when persistence changes.
- GitHub Actions should install reproducibly, call the same scripts developers use, and reuse platform workflows where available. Do not invent workflow interfaces that have not been published.
- Pull requests validate changes without production deployment credentials. Do not expose secrets to untrusted fork code or deploy unreviewed code through privileged pull-request workflows.
- Provide an explicit, convenient deployment action, such as `workflow_dispatch`, with a named target environment. Repository policy may additionally enable deployment after merge. Serialize deployments per app/environment to avoid racing migrations and releases.
- Keep staging and production resources and secrets separate. Use least-privilege Cloudflare API credentials and minimal GitHub workflow permissions; grant package-write only to publishing jobs.
- Build and deploy the verified revision through Wrangler, including its matching assets. Order migrations and deployments for compatibility, then smoke-test the deployed UI, API, authentication, and relevant live flow.
- Record the deployed revision and environment, and document rollback. Shared package publishing and application deployment are separate releases.
- Keep logs useful but free of private game content and credentials. Add modest error visibility and check resource limits when features introduce sustained connections or heavier queries; avoid unnecessary services for this small audience.

## How Codex should work here

Read the current repository instructions, manifests, scripts, and configuration first. Make the smallest complete change consistent with these boundaries. Reuse real platform capabilities before creating duplicates, but do not block a simple feature on an imagined platform abstraction. When introducing a shared capability, define and test its interface and publication path explicitly.

Keep modules readable and responsibilities narrow. Explain material architectural deviations and update documentation when conventions change. Report what changed, the checks actually run, and any remaining limitations. Never claim a package exists, a migration ran, or a deployment succeeded without evidence.

Never execute a GIT command that will write to the repository. It is okay to execute read only commands like `git status` and `git diff` but never stage, commit, or push.

## Reference documentation

Consult current official documentation before changing tooling or security configuration; repository-pinned versions determine the applicable APIs.

- CLOUDFLARE AGENTS.md contains Cloudflare's official agent context file and should be consulted prior to using Cloudflare
- [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [Workers local development](https://developers.cloudflare.com/workers/local-development/)
- [Workers static asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
- [Cloudflare Access in Workers](https://developers.cloudflare.com/cloudflare-one/tutorials/access-workers/)
- [D1](https://developers.cloudflare.com/d1/) and [Drizzle D1 integration](https://orm.drizzle.team/docs/connect-cloudflare-d1)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [GitHub Packages npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
- [Reusable GitHub Actions workflows](https://docs.github.com/en/actions/sharing-automations/reusing-workflows)
