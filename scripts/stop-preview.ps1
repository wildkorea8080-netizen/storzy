$ErrorActionPreference = "Stop"
$previewRoot = Join-Path $PSScriptRoot "..\.preview"
foreach ($name in @("storefront", "fulfillment", "printful-order", "shopify", "mockup", "content", "pipeline", "generation", "api", "postgres")) {
  $pidFile = Join-Path $previewRoot "$name.pid"
  if (Test-Path -LiteralPath $pidFile) {
    $processId = [int](Get-Content -LiteralPath $pidFile)
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
      if ($name -in @("api","generation","pipeline","content","mockup","shopify","printful-order","fulfillment","storefront")) { & taskkill /PID $processId /T /F | Out-Null }
      else { Stop-Process -Id $processId -Force }
    }
    Remove-Item -LiteralPath $pidFile -Force
  }
}
Write-Output "STORZY preview stopped"
