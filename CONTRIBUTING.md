# Contributing

Thanks for your interest in finapp. Issues and pull requests are welcome.

## Setup

Requirements: Go 1.26+ and Node 22+.

```sh
make dev     # API on :8080 (database ./dev.db, seeded with sample data on first run) and Vite dev server with /api proxy
make seed    # recreate ./dev.db with fresh sample data
make test    # Go and web tests
make lint
make build   # produces ./finapp with the web app embedded
```

## Workflow

1. Open an issue describing the change.
2. Branch from `main` (`feat/...`, `fix/...`, `docs/...`).
3. Write the test first, then the code. Keep the domain package free of I/O.
4. Use [Conventional Commits](https://www.conventionalcommits.org/) in English, for example `feat(web): add year picker`.
5. Open a pull request. CI runs lint, tests and the build; it must be green.

## Architecture

Dependencies point inwards:

- `internal/domain`: pure business rules (money, split rules, summaries, recurrences).
- `internal/app`: use cases and the ports they need.
- `internal/storage/sqlite`: SQLite repositories and embedded migrations.
- `internal/httpapi`: JSON REST handlers.
- `internal/launch`: database location, port selection and browser launch.
- `web/`: React + TypeScript app, embedded into the binary.

The database schema is documented in [docs/schema.md](docs/schema.md).
