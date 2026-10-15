# Usage: scripts/with-server.ps1 [-Build] -- <command...>
# Starts the standalone server on $env:PORT (default 3100), waits for it, runs the command, stops the server.
param([switch]$Build, [Parameter(ValueFromRemainingArguments = $true)][string[]]$Cmd)
$ErrorActionPreference = 'Continue'
$env:PATH = "C:\Users\Сергей\.local\node-v24.18.0-win-x64;" + $env:PATH
$env:NEXT_TELEMETRY_DISABLED = '1'
if (-not $env:PORT) { $env:PORT = '3100' }
$env:HOSTNAME = '0.0.0.0'
Set-Location (Split-Path $PSScriptRoot)
if ($Build) {
  # build output goes to a file: piping it through PowerShell crashed the build twice (0xC0000409)
  corepack pnpm@11.22.0 exec next build *> "$env:TEMP\site-spike-build.log"
  $buildExit = $LASTEXITCODE
  "next build exit: $buildExit"
  if ($buildExit -ne 0) { Get-Content "$env:TEMP\site-spike-build.log" | Select-Object -Last 40; exit 1 }
  node scripts/copy-static.mjs
  "copy-static exit: $LASTEXITCODE"
}
$log = Join-Path $env:TEMP "site-spike-server-$env:PORT.log"
# example wiring: mock backend + credentials example adapter + BFF allowlist (all configuration)
$env:API_URL = 'http://127.0.0.1:4010'
$env:AUTH_ADAPTER = 'api-login'
$env:BFF_ALLOW = 'GET:/items'
$mock = Start-Process node -ArgumentList 'examples/mock-backend/server.mjs' -PassThru -NoNewWindow -RedirectStandardOutput "$log.mock"
$p = Start-Process node -ArgumentList '.next/standalone/apps/site/server.js' -PassThru -NoNewWindow -RedirectStandardOutput $log -RedirectStandardError "$log.err"
try {
  for ($i = 0; $i -lt 60; $i++) {
    try { Invoke-WebRequest "http://localhost:$($env:PORT)/en" -UseBasicParsing -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep -Milliseconds 300 }
  }
  if ($Cmd) { & $Cmd[0] $Cmd[1..($Cmd.Length)] 2>&1 | Where-Object { $_ -notmatch 'NO_COLOR' } }
} finally {
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  Stop-Process -Id $mock.Id -Force -ErrorAction SilentlyContinue
  'server log (stderr):'; Get-Content "$log.err" -ErrorAction SilentlyContinue | Select-Object -Last 20
}
