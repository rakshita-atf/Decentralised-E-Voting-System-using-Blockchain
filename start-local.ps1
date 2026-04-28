# ═══════════════════════════════════════════════════════
#  start-local.ps1  —  One-click dev environment launcher
#  Runs Hardhat node, deploys contracts, starts frontend
# ═══════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🗳  Blockchain E-Voting — Local Dev Launcher" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Start Hardhat node in a new terminal window ──
Write-Host "[1/3] Starting Hardhat node on http://127.0.0.1:8545 ..." -ForegroundColor Yellow
$hardhatDir = Join-Path $Root "hardhat"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$hardhatDir'; npx hardhat node" -WindowStyle Normal
Write-Host "      Hardhat node started in a new window." -ForegroundColor Green
Write-Host ""

# Give the node 4 seconds to boot
Write-Host "      Waiting 4s for node to boot..." -ForegroundColor DarkGray
Start-Sleep -Seconds 4

# ── Step 2: Compile + Deploy contracts ──
Write-Host "[2/3] Compiling and deploying contracts ..." -ForegroundColor Yellow
Set-Location $hardhatDir
npx hardhat compile --quiet
npx hardhat run scripts/deploy.js --network localhost
Write-Host ""

# ── Step 3: Start Next.js frontend ──
Write-Host "[3/3] Starting frontend on http://localhost:3000 ..." -ForegroundColor Yellow
$frontendDir = Join-Path $Root "frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendDir'; npm run dev" -WindowStyle Normal
Write-Host "      Frontend started in a new window." -ForegroundColor Green
Write-Host ""

Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✅ All services running!" -ForegroundColor Green
Write-Host "" 
Write-Host "  📡 Hardhat node  →  http://127.0.0.1:8545  (chain 31337)" -ForegroundColor White
Write-Host "  🌐 Frontend      →  http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "  MetaMask setup (one-time):" -ForegroundColor Yellow
Write-Host "    Network Name : Hardhat Local" -ForegroundColor Gray
Write-Host "    RPC URL      : http://127.0.0.1:8545" -ForegroundColor Gray
Write-Host "    Chain ID     : 31337" -ForegroundColor Gray
Write-Host "    Currency     : ETH" -ForegroundColor Gray
Write-Host ""
Write-Host "  Import a test account (private key from Hardhat node output)" -ForegroundColor Yellow
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Set-Location $Root
