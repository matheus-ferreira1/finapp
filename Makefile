.PHONY: dev dev-api dev-web web test test-go test-web lint build clean

dev-api:
	go run ./cmd/finapp

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
