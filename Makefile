.PHONY: dev dev-api dev-web seed web test test-go test-web lint build clean

# Recreates ./dev.db with sample data.
seed:
	go run ./cmd/finapp-seed --db ./dev.db --force

# Seeds ./dev.db with sample data on the first run only, so your edits are kept.
dev-api:
	go run ./cmd/finapp-seed --db ./dev.db
	go run ./cmd/finapp --db ./dev.db --no-browser

dev-web:
	cd web && npm run dev

dev:
	$(MAKE) -j2 dev-api dev-web

web:
	cd web && npm ci && npm run build

test: test-go test-web

test-go:
	go test ./...

test-web:
	cd web && npm test

lint:
	go vet ./...
	cd web && npm run lint

build: web
	go build -o finapp ./cmd/finapp

clean:
	rm -f finapp
	find web/dist -mindepth 1 ! -name .gitkeep -delete
