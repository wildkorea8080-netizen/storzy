$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$previewRoot = Join-Path $projectRoot ".preview"
$dataRoot = Join-Path $previewRoot "postgres"
$pgBin = "C:\Program Files\PostgreSQL\16\bin"
New-Item -ItemType Directory -Force -Path $previewRoot | Out-Null
if (-not (Test-Path (Join-Path $dataRoot "PG_VERSION"))) { & (Join-Path $pgBin "initdb.exe") -D $dataRoot -U postgres -A trust --encoding=UTF8 --no-locale }
$ready = & (Join-Path $pgBin "pg_isready.exe") -h 127.0.0.1 -p 55446
if ($LASTEXITCODE -ne 0) {
  $postgres = Start-Process -FilePath (Join-Path $pgBin "postgres.exe") -ArgumentList "-D",$dataRoot,"-p","55446" -WindowStyle Hidden -PassThru
  Set-Content -Encoding ascii -Path (Join-Path $previewRoot "postgres.pid") -Value $postgres.Id
  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    & (Join-Path $pgBin "pg_isready.exe") -h 127.0.0.1 -p 55446 | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw "Preview PostgreSQL did not become ready" }
}
$env:DATABASE_URL = "postgresql://postgres@127.0.0.1:55446/postgres"
npm run db:migrate
if ($LASTEXITCODE -ne 0) { throw "Database migration failed" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed" }
$health = try { (Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:3000/health" -TimeoutSec 1).StatusCode } catch { 0 }
if ($health -ne 200) {
  $arguments = "/c set DATABASE_URL=$env:DATABASE_URL&& set PORT=3000&& set ADMIN_API_TOKEN=preview-admin&& set SHOPIFY_WEBHOOK_SECRET=storzy-preview-shopify-secret&& set INTEGRATION_CREDENTIAL_KEY_BASE64=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=&& set INTEGRATION_CREDENTIAL_KEY_VERSION=preview-v1&& set PREVIEW_MODE=1&& node dist\src\server.js 1>`"$previewRoot\api.out.log`" 2>`"$previewRoot\api.err.log`""
  $api = Start-Process -FilePath "C:\Windows\System32\cmd.exe" -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
  Set-Content -Encoding ascii -Path (Join-Path $previewRoot "api.pid") -Value $api.Id
  Start-Sleep -Seconds 2
}
$generationPid = Join-Path $previewRoot "generation.pid"
$generation = if (Test-Path $generationPid) { Get-Process -Id ([int](Get-Content $generationPid)) -ErrorAction SilentlyContinue } else { $null }
if (-not $generation) {
  $workerArguments = "/c set DATABASE_URL=$env:DATABASE_URL&& node dist\src\preview-generation-worker.js 1>`"$previewRoot\generation.out.log`" 2>`"$previewRoot\generation.err.log`""
  $generation = Start-Process -FilePath "C:\Windows\System32\cmd.exe" -ArgumentList $workerArguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
  Set-Content -Encoding ascii -Path $generationPid -Value $generation.Id
}
$pipelinePid = Join-Path $previewRoot "pipeline.pid"
$pipeline = if (Test-Path $pipelinePid) { Get-Process -Id ([int](Get-Content $pipelinePid)) -ErrorAction SilentlyContinue } else { $null }
if (-not $pipeline) {
  $pipelineArguments = "/c set DATABASE_URL=$env:DATABASE_URL&& node dist\src\preview-pipeline-worker.js 1>`"$previewRoot\pipeline.out.log`" 2>`"$previewRoot\pipeline.err.log`""
  $pipeline = Start-Process -FilePath "C:\Windows\System32\cmd.exe" -ArgumentList $pipelineArguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
  Set-Content -Encoding ascii -Path $pipelinePid -Value $pipeline.Id
}
$contentPid = Join-Path $previewRoot "content.pid"
$content = if (Test-Path $contentPid) { Get-Process -Id ([int](Get-Content $contentPid)) -ErrorAction SilentlyContinue } else { $null }
if (-not $content) {
  $contentArguments = "/c set DATABASE_URL=$env:DATABASE_URL&& node dist\src\preview-content-worker.js 1>`"$previewRoot\content.out.log`" 2>`"$previewRoot\content.err.log`""
  $content = Start-Process -FilePath "C:\Windows\System32\cmd.exe" -ArgumentList $contentArguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
  Set-Content -Encoding ascii -Path $contentPid -Value $content.Id
}
$mockupPid = Join-Path $previewRoot "mockup.pid"
$mockup = if (Test-Path $mockupPid) { Get-Process -Id ([int](Get-Content $mockupPid)) -ErrorAction SilentlyContinue } else { $null }
if (-not $mockup) {
  $mockupArguments = "/c set DATABASE_URL=$env:DATABASE_URL&& node dist\src\preview-mockup-worker.js 1>`"$previewRoot\mockup.out.log`" 2>`"$previewRoot\mockup.err.log`""
  $mockup = Start-Process -FilePath "C:\Windows\System32\cmd.exe" -ArgumentList $mockupArguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
  Set-Content -Encoding ascii -Path $mockupPid -Value $mockup.Id
}
$shopifyPid = Join-Path $previewRoot "shopify.pid"
$shopify = if (Test-Path $shopifyPid) { Get-Process -Id ([int](Get-Content $shopifyPid)) -ErrorAction SilentlyContinue } else { $null }
if (-not $shopify) {
  $shopifyArguments = "/c set DATABASE_URL=$env:DATABASE_URL&& node dist\src\preview-shopify-worker.js 1>`"$previewRoot\shopify.out.log`" 2>`"$previewRoot\shopify.err.log`""
  $shopify = Start-Process -FilePath "C:\Windows\System32\cmd.exe" -ArgumentList $shopifyArguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
  Set-Content -Encoding ascii -Path $shopifyPid -Value $shopify.Id
}
$printfulOrderPid = Join-Path $previewRoot "printful-order.pid"
$printfulOrder = if (Test-Path $printfulOrderPid) { Get-Process -Id ([int](Get-Content $printfulOrderPid)) -ErrorAction SilentlyContinue } else { $null }
if (-not $printfulOrder) {
  $printfulOrderArguments = "/c set DATABASE_URL=$env:DATABASE_URL&& node dist\src\preview-printful-order-worker.js 1>`"$previewRoot\printful-order.out.log`" 2>`"$previewRoot\printful-order.err.log`""
  $printfulOrder = Start-Process -FilePath "C:\Windows\System32\cmd.exe" -ArgumentList $printfulOrderArguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
  Set-Content -Encoding ascii -Path $printfulOrderPid -Value $printfulOrder.Id
}
$fulfillmentPid = Join-Path $previewRoot "fulfillment.pid"
$fulfillment = if (Test-Path $fulfillmentPid) { Get-Process -Id ([int](Get-Content $fulfillmentPid)) -ErrorAction SilentlyContinue } else { $null }
if (-not $fulfillment) {
  $fulfillmentArguments = "/c set DATABASE_URL=$env:DATABASE_URL&& node dist\src\preview-shopify-fulfillment-worker.js 1>`"$previewRoot\fulfillment.out.log`" 2>`"$previewRoot\fulfillment.err.log`""
  $fulfillment = Start-Process -FilePath "C:\Windows\System32\cmd.exe" -ArgumentList $fulfillmentArguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
  Set-Content -Encoding ascii -Path $fulfillmentPid -Value $fulfillment.Id
}
$storefrontPid = Join-Path $previewRoot "storefront.pid"
$storefront = if (Test-Path $storefrontPid) { Get-Process -Id ([int](Get-Content $storefrontPid)) -ErrorAction SilentlyContinue } else { $null }
if (-not $storefront) {
  $storefrontArguments = "/c set DATABASE_URL=$env:DATABASE_URL&& node dist\src\preview-storefront-worker.js 1>`"$previewRoot\storefront.out.log`" 2>`"$previewRoot\storefront.err.log`""
  $storefront = Start-Process -FilePath "C:\Windows\System32\cmd.exe" -ArgumentList $storefrontArguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
  Set-Content -Encoding ascii -Path $storefrontPid -Value $storefront.Id
}
Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:3000/health" | Select-Object -ExpandProperty Content
Write-Output "Preview: http://localhost:3000/admin"
Write-Output "Admin token: preview-admin"
