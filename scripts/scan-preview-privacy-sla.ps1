$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$env:DATABASE_URL = "postgresql://postgres@127.0.0.1:55446/postgres"
Push-Location $projectRoot
try {
  npm run privacy-sla:scan
  if ($LASTEXITCODE -ne 0) { throw "Privacy SLA preview scan failed" }
} finally {
  Pop-Location
}
