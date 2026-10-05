$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    $codexNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (Test-Path -LiteralPath $codexNode) { $nodeCommand = [pscustomobject]@{ Source = $codexNode } }
}
if (-not $nodeCommand) {
    Write-Host 'Please install Node.js 20 or newer from https://nodejs.org then run Start-Game.cmd again.'
    exit 1
}
$nodeMajor = [int]((& $nodeCommand.Source -p 'process.versions.node').Split('.')[0])
if ($nodeMajor -lt 20) { Write-Host 'Node.js 20 or newer is required.'; exit 1 }
$serverDirectory = Join-Path $PSScriptRoot 'server'
if (-not (Test-Path -LiteralPath (Join-Path $serverDirectory 'node_modules\express'))) {
    $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $npmCommand) { Write-Host 'npm was not found. Reinstall Node.js with npm enabled.'; exit 1 }
    Push-Location -LiteralPath $serverDirectory
    try {
        & $npmCommand.Source install
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    } finally { Pop-Location }
}
$gamePort = if ($env:PORT) { $env:PORT } else { '3000' }
Write-Host "Dynasty v1.3 - open http://localhost:$gamePort in your browser."
Write-Host "Friends on the same Wi-Fi can use this computer's LAN IP and port $gamePort."
Write-Host 'Keep this window open while playing. Press Ctrl+C to stop the server.'
& $nodeCommand.Source (Join-Path $serverDirectory 'server.js')
exit $LASTEXITCODE
