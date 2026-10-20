#!/usr/bin/env bash
# Builds the extension, packages it into sakuga.vsix and installs it into VS Code.
# Needs npm and the `code` command.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# vsce needs a newer Node than many distributions ship; VS Code's own Electron runs as Node.
VSCODE_NODE="$(dirname "$(readlink -f "$(command -v code)")")/../code"

npm install --no-audit --no-fund --loglevel=error
npm run compile
ELECTRON_RUN_AS_NODE=1 "$VSCODE_NODE" node_modules/@vscode/vsce/vsce package --allow-missing-repository --skip-license --out sakuga.vsix
code --install-extension sakuga.vsix --force
echo "Installed. Run 'Developer: Reload Window' in open VS Code windows to load the new version."
