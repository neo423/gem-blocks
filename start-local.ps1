$node = "C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if (-not (Test-Path $node)) {
  Write-Error "找不到 Codex 內建 Node.js：$node"
  exit 1
}

& $node ".\scripts\dev-server.mjs"
