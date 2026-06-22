---
name: onion-architecture
description: Answer architecture and file-placement questions for the server/ backend — which layer owns this logic, what can import what, where repository interfaces go, how the DI container is the composition root, and how to keep Drizzle out of services. Use whenever the user asks about backend module structure, cross-module dependencies, service/repository/adapter boundaries, domain model placement, or "where does this code go?" in server/. Also use when reviewing new modules for layer violations, or when the user asks about ports & adapters, clean architecture, or hexagonal architecture in the backend context.
allowed-tools: Read, Bash(grep:*, find:*)
---

# Onion Architecture — server/ (@devdigest/api)

Answer architecture and file-placement questions for the `server/` package (Fastify 5 · Drizzle ORM · Zod · TypeScript). Always ground answers in the **project's existing conventions first**.

## This project uses Vertical Slices + Onion rings within each slice

The codebase is NOT organized as horizontal layers (`controllers/`, `services/`, `repositories/` at the root). It uses **vertical slices by feature** (`modules/<name>/`), and the Onion rings live *inside* each slice. This is known as "Sliced Onion Architecture" — it's intentional and correct. Don't recommend flattening into global layer folders.

```
modules/repos/
├── routes.ts      ← Presentation ring
├── service.ts     ← Domain/Application Services ring
├── repository.ts  ← Infrastructure ring (data access)
├── types.ts       ← Domain Core (entities, interfaces)
├── helpers.ts     ← Pure transforms (no ring — stateless)
└── constants.ts   ← Literals
```

---

## Layer Map: Onion rings → project files

```
┌─────────────────────────────────────────────────────┐
│  Presentation          modules/<name>/routes.ts      │
│ ┌─────────────────────────────────────────────────┐ │
│ │  Application Services  modules/<name>/service.ts │ │
│ │ ┌─────────────────────────────────────────────┐ │ │
│ │ │  Domain Services     modules/<name>/service  │ │ │
│ │ │ ┌─────────────────────────────────────────┐ │ │ │
│ │ │ │  Domain Core   modules/<name>/types.ts  │ │ │ │
│ │ │ │                vendor/shared/contracts/ │ │ │ │
│ │ │ └─────────────────────────────────────────┘ │ │ │
│ │ └─────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────┘ │
│  Infrastructure    adapters/<service>/               │
│                    db/schema/<domain>.ts             │
│                    platform/                         │
└─────────────────────────────────────────────────────┘
         platform/container.ts = Composition Root
```

**Each ring may only import from rings closer to the center.** The center has zero external dependencies.

---

## The Golden Rule: dependency direction

Inner rings NEVER import outer rings.

| Layer | What it may import | What it may NOT import |
|-------|--------------------|------------------------|
| `routes.ts` | `service.ts`, Zod schemas, `_shared/` | `db/schema/*`, `adapters/`, other module's `service.ts` |
| `service.ts` | `types.ts`, `helpers.ts`, `constants.ts`, `container` (via constructor) | `db/schema/*`, `routes.ts`, `adapters/<x>/` directly |
| `repository.ts` | `db/schema/<domain>.ts`, `db/client.ts` | `platform/jobs.ts`, `adapters/`, other `modules/` |
| `adapters/<x>/` | External SDKs, `vendor/shared/adapters.ts` | `modules/`, `db/schema/*` |
| `types.ts` | Zod, primitive types | Anything infrastructure |

**Red line for Drizzle:** `db/schema/*` imports are the boundary. The `db` *client* can flow through `container.db` into a repository constructor — that's fine. What's forbidden is a service calling `db.select().from(reposTable)` directly.

---

## Ports & Adapters (how DI works here)

- **Port (interface)** — defined in:
  - `vendor/shared/adapters.ts` for cross-cutting infrastructure (LLM, secrets, GitHub, git, embedder)
  - `modules/<name>/types.ts` for a module's own repository interface
- **Adapter (implementation)** — lives in:
  - `adapters/<service>/index.ts` for cross-cutting ports
  - `modules/<name>/repository.ts` for the module's data-access port
- **Composition Root** — `platform/container.ts` wires ports → adapters. Services receive the container via constructor and call `container.secrets`, `container.github()`, etc. — never importing the adapter class directly.

```typescript
// ✅ Service depends on Container interface, not concrete adapter
class RepoService {
  constructor(private container: Container) {}

  async add(workspaceId: string, url: string) {
    const token = await this.container.secrets.get('GITHUB_TOKEN'); // ← Port
    const github = await this.container.github();                   // ← Port
    const repo = await new RepoRepository(this.container.db)
      .findByFullName(workspaceId, parsedName);                     // ← Port
  }
}

// ❌ Importing concrete adapter directly
import { GitHubClient } from '../../adapters/github';
class RepoService {
  async add(...) {
    const github = new GitHubClient(token); // ← bypasses DI, untestable
  }
}
```

---

## Repository Pattern — correct form

The repository owns all Drizzle queries for one table. The service calls repository methods and never touches `db/schema/*`.

```typescript
// modules/repos/types.ts — the Port (interface)
export interface IRepoRepository {
  findByFullName(workspaceId: string, fullName: string): Promise<Repo | null>;
  insert(data: NewRepo): Promise<Repo>;
}

// modules/repos/repository.ts — the Adapter (implementation)
import { repos } from '../../db/schema/repos'; // ← Drizzle import lives HERE only
export class RepoRepository implements IRepoRepository {
  constructor(private db: DrizzleDb) {}

  async findByFullName(workspaceId: string, fullName: string) {
    return this.db.select().from(repos)
      .where(and(eq(repos.workspaceId, workspaceId), eq(repos.fullName, fullName)))
      .then(r => r[0] ?? null);
  }
}

// modules/repos/service.ts — depends on interface, not Drizzle
export class RepoService {
  constructor(private container: Container) {}

  async add(workspaceId: string, url: string) {
    const repo = new RepoRepository(this.container.db);
    const existing = await repo.findByFullName(workspaceId, parsedName);
    // ← service never sees "import { repos } from '../../db/schema'"
  }
}
```

**Anti-pattern → correct:**
```typescript
// ❌ Drizzle leaking into service
import { repos } from '../../db/schema/repos';
class RepoService {
  async add(...) {
    const existing = await db.select().from(repos).where(...); // move to repository
  }
}

// ✅ Service calls repository method
class RepoService {
  async add(...) {
    const existing = await this.repo.findByFullName(workspaceId, name);
  }
}
```

---

## Cross-Module Communication Rules

- Module A must **NEVER** import Module B's `repository.ts` directly.
- Module A **may** instantiate Module B's `service.ts` (acceptable today; injectable via container is better).
- For loose coupling: extract a shared contract to `vendor/shared/contracts/` and inject via container.

```typescript
// ❌ Reviews accessing Repos table directly
import { RepoRepository } from '../repos/repository';
class ReviewService {
  async run(repoId: string) {
    const repo = await new RepoRepository(db).findById(repoId); // wrong — bypasses Repos module
  }
}

// ✅ Reviews calls Repos service (or container provides it)
class ReviewService {
  async run(repoId: string) {
    const repo = await new RepoService(this.container).getById(repoId);
  }
}
```

---

## Checklist for a New Module

- [ ] Define domain types + repository interface in `modules/<name>/types.ts`
- [ ] `routes.ts`: parse HTTP input → call service → serialize DTO. Zero business logic.
- [ ] `service.ts`: business rules, container adapter calls, job enqueueing. No Drizzle.
- [ ] `repository.ts`: Drizzle queries only, always scoped by `workspaceId`.
- [ ] `helpers.ts`: pure DTO converters, URL parsing. No side effects, no async.
- [ ] `constants.ts`: job kind strings, limits, enum values.
- [ ] Register Fastify plugin in `modules/index.ts`.
- [ ] Register job handlers in `platform/jobs.ts` if background work is needed.
- [ ] Add injectable adapters to `platform/container.ts` if the module introduces new infrastructure.

---

## Testing Alignment

| What | How |
|------|-----|
| Service logic | Unit test with `ContainerOverrides` (swap adapters for test doubles) |
| Repository queries | Integration test hitting real Postgres via `@testcontainers/postgresql` |
| Routes | Fastify `inject()` with container or overrides |
| Never | Mock a repository inside a service test — use `ContainerOverrides` instead |

The Onion rule for tests: test each ring independently. Services must be testable without a real DB; repositories must be tested against a real DB (not mocked).

---

## When NOT to add a layer

For simple CRUD modules (e.g., `settings/`), a thin service that delegates directly to a repository is correct. Do NOT force:
- Domain events for a feature with no cross-module cascades
- Rich domain models for pure CRUD
- Repository interfaces in `vendor/shared/` for module-private tables

Add abstraction when a *second consumer* or *testability need* appears. Three similar lines without abstraction beat a premature generic.

---

## Anti-Patterns to Flag Immediately

| Anti-pattern | Correct approach |
|---|---|
| `import { reposTable } from '../../db/schema'` in `service.ts` | Move Drizzle query to `repository.ts` |
| `if/else` business logic in `routes.ts` | Move to `service.ts` |
| `import { ReviewService } from '../reviews/service'` in another module without DI | Access via container or inject as dependency |
| `container.jobs.enqueue()` called inside `repository.ts` | Job scheduling belongs in `service.ts` |
| Raw `db.select()` in `routes.ts` | Create a repository method |
| Global layer folders (`controllers/`, `services/`) at `src/` root | Keep vertical slices in `modules/<name>/` |

---

## Quick-Reference Cheat Sheet

```
modules/<name>/routes.ts      ← HTTP only: parse → call service → return DTO
modules/<name>/service.ts     ← Business logic, adapter calls via container
modules/<name>/repository.ts  ← Drizzle queries, always workspace-scoped
modules/<name>/types.ts       ← Domain entities, repository interface
modules/<name>/helpers.ts     ← Pure transforms (no side effects)
modules/<name>/constants.ts   ← Literals, job kind strings

platform/container.ts         ← Composition root; wire ports → adapters here
adapters/<service>/           ← Outer ring; implements vendor/shared interfaces
vendor/shared/adapters.ts     ← Port interfaces (SecretsProvider, LLMProvider, …)
vendor/shared/contracts/      ← Zod schemas for API + internal data shapes
db/schema/<domain>.ts         ← Drizzle table defs; imported ONLY by repository.ts
```

---

## Giving a Concrete Answer

1. State the layer rule in one sentence.
2. Give the exact file path (`server/src/modules/<name>/...`) where the code belongs.
3. If the question reveals a violation, name the anti-pattern and show the correct form.
4. For deeper reading, point to `server/docs/onion-architecture-sources.md`.
