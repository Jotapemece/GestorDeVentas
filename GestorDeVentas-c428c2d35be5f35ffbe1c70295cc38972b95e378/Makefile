.PHONY: dev build build:android build:android:apk build:android:debug combine clean help

APP_NAME = InariMarket

help:
	@echo "$(APP_NAME) — POS de Escritorio (Tauri v2 + Rust + SQLite)"
	@echo ""
	@echo "Usage:"
	@echo "  make dev              Iniciar Tauri dev (hot-reload)"
	@echo "  make build            Build desktop release"
	@echo "  make build:android    Build Android release (AAB)"
	@echo "  make build:android:apk  Build Android APK release"
	@echo "  make build:android:debug Build Android debug APK"
	@echo "  make combine          Consolidar fuentes en combined.txt"
	@echo "  make clean            Limpiar artifacts de build"
	@echo ""

dev:
	npm run dev

build:
	npm run build

build:android:
	npx tauri android build

build:android:apk:
	npx tauri android build --apk

build:android:debug:
	npx tauri android build --apk --debug

combined.txt: src/index.html src/style.css src/app.js src/fa-local.css src-tauri/src/main.rs src-tauri/src/lib.rs src-tauri/src/db.rs src-tauri/src/models.rs src-tauri/src/auth.rs src-tauri/src/products.rs src-tauri/src/sales.rs src-tauri/src/clients.rs src-tauri/src/cashier.rs src-tauri/src/categorias.rs src-tauri/src/audit.rs src-tauri/src/config.rs src-tauri/tauri.conf.json src-tauri/Cargo.toml package.json README.md
	@echo "=== src/index.html ===" > $@
	@cat src/index.html >> $@
	@echo "" >> $@
	@echo "=== src/style.css ===" >> $@
	@cat src/style.css >> $@
	@echo "" >> $@
	@echo "=== src/app.js ===" >> $@
	@cat src/app.js >> $@
	@echo "" >> $@
	@echo "=== src/fa-local.css ===" >> $@
	@cat src/fa-local.css >> $@
	@echo "" >> $@
	@echo "=== src-tauri/src/main.rs ===" >> $@
	@cat src-tauri/src/main.rs >> $@
	@echo "" >> $@
	@echo "=== src-tauri/src/lib.rs ===" >> $@
	@cat src-tauri/src/lib.rs >> $@
	@echo "" >> $@
	@echo "=== src-tauri/src/db.rs ===" >> $@
	@cat src-tauri/src/db.rs >> $@
	@echo "" >> $@
	@echo "=== src-tauri/src/models.rs ===" >> $@
	@cat src-tauri/src/models.rs >> $@
	@echo "" >> $@
	@echo "=== src-tauri/src/auth.rs ===" >> $@
	@cat src-tauri/src/auth.rs >> $@
	@echo "" >> $@
	@echo "=== src-tauri/src/products.rs ===" >> $@
	@cat src-tauri/src/products.rs >> $@
	@echo "" >> $@
	@echo "=== src-tauri/src/sales.rs ===" >> $@
	@cat src-tauri/src/sales.rs >> $@
	@echo "" >> $@
	@echo "=== src-tauri/src/clients.rs ===" >> $@
	@cat src-tauri/src/clients.rs >> $@
	@echo "" >> $@
	@echo "=== src-tauri/src/cashier.rs ===" >> $@
	@cat src-tauri/src/cashier.rs >> $@
	@echo "" >> $@
	@echo "=== src-tauri/src/categorias.rs ===" >> $@
	@cat src-tauri/src/categorias.rs >> $@
	@echo "" >> $@
	@echo "=== src-tauri/src/audit.rs ===" >> $@
	@cat src-tauri/src/audit.rs >> $@
	@echo "" >> $@
	@echo "=== src-tauri/src/config.rs ===" >> $@
	@cat src-tauri/src/config.rs >> $@
	@echo "" >> $@
	@echo "=== src-tauri/tauri.conf.json ===" >> $@
	@cat src-tauri/tauri.conf.json >> $@
	@echo "" >> $@
	@echo "=== src-tauri/Cargo.toml ===" >> $@
	@cat src-tauri/Cargo.toml >> $@
	@echo "" >> $@
	@echo "=== package.json ===" >> $@
	@cat package.json >> $@
	@echo "" >> $@
	@echo "=== README.md ===" >> $@
	@cat README.md >> $@
	@echo "Generated combined.txt" >&2

combine: combined.txt

clean:
	rm -f combined.txt
	cargo clean --manifest-path src-tauri/Cargo.toml
	rm -rf src-tauri/gen/android/build
	rm -rf src-tauri/gen/android/app/build
	rm -rf src-tauri/target
	@echo "Clean done"
