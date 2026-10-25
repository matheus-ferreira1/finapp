# finapp

A local-first personal finance app that replaces a spreadsheet. A single binary
(Go + SQLite + embedded React app): run it and it opens in your browser. Your data
stays in one SQLite file on your machine.

> Work in progress.

## Running

Run `./finapp`: it starts a local server and opens your browser. Closing the terminal stops it.

- The database is `finapp.db` next to the executable. Override it with `--db <path>` or `FINAPP_DB`; the flag wins.
- The default address is `127.0.0.1:8080`. If another finapp is already there, only the browser opens; if something else is, a free port is used. `--addr` fixes the address.
- `--no-browser` skips opening the browser.

## Development

Requirements: Go 1.25+ and Node 22+.

```sh
make dev     # API on :8080 (database ./dev.db) and Vite dev server with /api proxy
make test    # Go and web tests
make lint
make build   # produces ./finapp with the web app embedded
```

## License

[MIT](LICENSE)
