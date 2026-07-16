#!/bin/bash
set -e

TARGET=${1:-i686-pc-windows-gnu}
DIST="dist/gestor-ventas"

npm run tauri build -- --config '{"bundle":{"active":false}}' --target "$TARGET"

mkdir -p "$DIST"
cp "src-tauri/target/$TARGET/release/gestor-ventas.exe" "$DIST/"
cp "src-tauri/target/$TARGET/release/WebView2Loader.dll" "$DIST/"

echo "=== Portable build listo en: $DIST ==="
ls -lh "$DIST/"
