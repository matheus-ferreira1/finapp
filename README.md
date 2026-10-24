# finapp

A local-first personal finance app that replaces a spreadsheet. A single binary
(Go + SQLite + embedded React app): run it and it opens in your browser. Your data
stays in one SQLite file on your machine.

> Work in progress.

## Development

Requirements: Go 1.25+ and Node 22+.

```sh
make dev     # API on :8080 and Vite dev server with /api proxy
make test    # Go and web tests
make lint
make build   # produces ./finapp with the web app embedded
```

## License

[MIT](LICENSE)
