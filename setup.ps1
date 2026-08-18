param(
  [string]$Mode = "auto"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== VUNA Football League - Setup Script ===" -ForegroundColor Cyan
Write-Host "Project: $root" -ForegroundColor Cyan
Write-Host ""

function Download-Package {
  param([string]$Name, [string]$Version)
  
  $dir = Join-Path $root "node_modules" $Name
  $parent = Split-Path $dir -Parent
  if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  
  # Get version from npm registry if not specified
  if (-not $Version) {
    $json = (New-Object System.Net.WebClient).DownloadString("https://registry.npmjs.org/$Name/latest")
    $Version = ($json | ConvertFrom-Json).version
  }
  
  $tgz = "$env:TEMP\npm-fallback-$($Name.Replace('/','-'))-$Version.tgz"
  $url = "https://registry.npmjs.org/$Name/-/$($Name.Split('/')[-1])-$Version.tgz"
  Write-Host "  Downloading $Name@$Version ..." -NoNewline
  
  try {
    (New-Object System.Net.WebClient).DownloadFile($url, $tgz)
  } catch {
    Write-Host " FAILED (trying scoped URL)" -ForegroundColor Yellow
    # Scoped packages have different URL format
    $scope = $Name.Split('/')[0]
    $pkg = $Name.Split('/')[1]
    $url = "https://registry.npmjs.org/$Name/-/$pkg-$Version.tgz"
    (New-Object System.Net.WebClient).DownloadFile($url, $tgz)
  }
  
  Write-Host " OK ($((Get-Item $tgz).Length / 1KB -as [int]) KB)" -ForegroundColor Green
  
  # Extract
  if (Test-Path $dir) { Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue }
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  tar -xzf $tgz -C $dir --strip-components 1 2>$null
  Remove-Item $tgz -Force -ErrorAction SilentlyContinue
}

function Install-Deps {
  Write-Host "`nStep 1: Installing via npm ..." -ForegroundColor Yellow
  $npmOk = $true
  try {
    $result = npm install --no-optional --ignore-scripts 2>&1
    if ($LASTEXITCODE -ne 0) { $npmOk = $false }
  } catch { $npmOk = $false }
  
  if ($npmOk -and (Test-Path "$root\node_modules\next\package.json")) {
    Write-Host "npm install succeeded!" -ForegroundColor Green
    return $true
  }
  
  Write-Host "npm install failed (known npm 11.7.0 dedup bug). Switching to manual install ..." -ForegroundColor Yellow
  return $false
}

function Install-Manual {
  Write-Host "`nStep 2: Manual package download ..." -ForegroundColor Yellow
  
  # Remove broken node_modules if any
  if (Test-Path "$root\node_modules") {
    Remove-Item -Recurse -Force "$root\node_modules" -ErrorAction SilentlyContinue
  }
  New-Item -ItemType Directory -Path "$root\node_modules" -Force | Out-Null
  
  # Top-level dependencies (with pinned versions)
  $packages = @(
    @{Name="next"; Version="14.2.35"},
    @{Name="react"; Version="18.3.1"},
    @{Name="react-dom"; Version="18.3.1"},
    @{Name="zustand"; Version="4.5.7"},
    @{Name="clsx"; Version="2.1.1"},
    @{Name="lucide-react"; Version="0.303.0"},
    @{Name="postcss"; Version="8.5.14"},
    @{Name="autoprefixer"; Version="10.5.0"},
    @{Name="tailwindcss"; Version="3.4.19"},
    @{Name="typescript"; Version="5.9.3"},
    @{Name="@types/node"; Version="20.17.41"},
    @{Name="@types/react"; Version="18.3.28"},
    @{Name="@types/react-dom"; Version="18.3.7"}
  )
  
  foreach ($pkg in $packages) {
    Download-Package -Name $pkg.Name -Version $pkg.Version
  }
  
  Write-Host "`nStep 3: Installing transitive dependencies ..." -ForegroundColor Yellow
  Write-Host "Running npm install (with existing packages preserved) ..."
  npm install --no-optional --ignore-scripts --prefer-offline 2>&1 | Out-Null
  
  if ($LASTEXITCODE -ne 0) {
    Write-Host "`nStep 4: Resolving deep dependencies manually ..." -ForegroundColor Yellow
    Install-DeepDeps
  }
  
  # Create .bin shims
  Create-Shims
}

function Install-DeepDeps {
  # These are common transitive dependencies that npm might have missed
  $deepPackages = @(
    @{Name="scheduler"; Version="0.23.2"},
    @{Name="js-tokens"; Version="4.0.0"},
    @{Name="loose-envify"; Version="1.4.0"},
    @{Name="nanoid"; Version="3.3.12"},
    @{Name="picocolors"; Version="1.1.1"},
    @{Name="source-map-js"; Version="1.2.1"},
    @{Name="caniuse-lite"; Version="1.0.30001718"},
    @{Name="fraction.js"; Version="5.3.4"},
    @{Name="normalize-range"; Version="0.1.2"},
    @{Name="object-assign"; Version="4.1.1"},
    @{Name="ts-interface-checker"; Version="0.1.13"},
    @{Name="commander"; Version="4.1.1"},
    @{Name="glob"; Version="10.4.5"},
    @{Name="hasown"; Version="2.0.3"},
    @{Name="is-core-module"; Version="2.16.2"},
    @{Name="function-bind"; Version="1.1.2"},
    @{Name="path-parse"; Version="1.0.7"},
    @{Name="resolve"; Version="1.22.12"},
    @{Name="supports-preserve-symlinks-flag"; Version="1.0.0"},
    @{Name="lilconfig"; Version="3.1.3"},
    @{Name="yaml"; Version="2.7.2"},
    @{Name="didyoumean"; Version="1.2.2"},
    @{Name="dlv"; Version="1.1.3"},
    @{Name="chokidar"; Version="3.6.0"},
    @{Name="anymatch"; Version="3.1.3"},
    @{Name="braces"; Version="3.0.3"},
    @{Name="fill-range"; Version="7.1.1"},
    @{Name="is-number"; Version="7.0.0"},
    @{Name="is-glob"; Version="4.0.3"},
    @{Name="is-extglob"; Version="2.1.1"},
    @{Name="glob-parent"; Version="5.1.2"},
    @{Name="normalize-path"; Version="3.0.0"},
    @{Name="readdirp"; Version="3.6.0"},
    @{Name="binary-extensions"; Version="2.3.0"},
    @{Name="fast-glob"; Version="3.3.3"},
    @{Name="fastq"; Version="1.20.1"},
    @{Name="reusify"; Version="1.1.0"},
    @{Name="run-parallel"; Version="1.2.0"},
    @{Name="queue-microtask"; Version="1.2.3"},
    @{Name="merge2"; Version="1.4.1"},
    @{Name="micromatch"; Version="4.0.8"},
    @{Name="picomatch"; Version="2.3.2"},
    @{Name="@nodelib/fs.stat"; Version="2.0.5"},
    @{Name="@nodelib/fs.scandir"; Version="2.1.5"},
    @{Name="@nodelib/fs.walk"; Version="1.2.8"},
    @{Name="graceful-fs"; Version="4.2.11"},
    @{Name="postcss-import"; Version="15.1.0"},
    @{Name="postcss-js"; Version="4.1.0"},
    @{Name="postcss-nested"; Version="6.2.0"},
    @{Name="postcss-selector-parser"; Version="6.1.2"},
    @{Name="postcss-value-parser"; Version="4.2.0"},
    @{Name="cssesc"; Version="3.0.0"},
    @{Name="util-deprecate"; Version="1.0.2"},
    @{Name="read-cache"; Version="1.0.0"},
    @{Name="pify"; Version="2.3.0"},
    @{Name="sucrase"; Version="3.35.1"},
    @{Name="thenify"; Version="3.3.1"},
    @{Name="thenify-all"; Version="1.6.0"},
    @{Name="any-promise"; Version="1.3.0"},
    @{Name="mz"; Version="2.7.0"},
    @{Name="lines-and-columns"; Version="1.2.4"},
    @{Name="pirates"; Version="4.0.7"},
    @{Name="jiti"; Version="1.21.7"},
    @{Name="csstype"; Version="3.2.3"},
    @{Name="@types/prop-types"; Version="15.7.15"},
    @{Name="client-only"; Version="0.0.1"},
    @{Name="styled-jsx"; Version="5.1.1"},
    @{Name="busboy"; Version="1.6.0"},
    @{Name="streamsearch"; Version="1.1.0"},
    @{Name="@swc/helpers"; Version="0.5.5"},
    @{Name="@swc/counter"; Version="0.1.3"},
    @{Name="caniuse-lite"; Version="1.0.30001718"},
    @{Name="use-sync-external-store"; Version="1.6.0"}
  )
  
  foreach ($pkg in $deepPackages) {
    $dir = Join-Path $root "node_modules" $pkg.Name
    if (-not (Test-Path "$dir\package.json")) {
      Download-Package -Name $pkg.Name -Version $pkg.Version
    }
  }
}

function Create-Shims {
  Write-Host "`nStep 5: Creating .bin shims ..." -ForegroundColor Yellow
  $binDir = Join-Path $root "node_modules\.bin"
  New-Item -ItemType Directory -Path $binDir -Force | Out-Null
  
  # Create shim for next
  $nextShim = @"
@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\next\dist\bin\next" %*
) ELSE (
  @SETLOCAL
  @SET PATHEXT=%PATHEXT:;.JS;=;%
  node  "%~dp0\..\next\dist\bin\next" %*
)
"@
  Set-Content -Path "$binDir\next.cmd" -Value $nextShim -Encoding ASCII
  
  # Create shim for next (PowerShell)
  $nextPs1 = @"
node "`$PSScriptRoot\..\next\dist\bin\next" $args
"@
  Set-Content -Path "$binDir\next.ps1" -Value $nextPs1 -Encoding ASCII
}

function Verify-Install {
  Write-Host "`n=== Verification ===" -ForegroundColor Cyan
  
  $checks = @(
    @{Path="next\package.json"; Label="Next.js"},
    @{Path="react\package.json"; Label="React"},
    @{Path="react-dom\package.json"; Label="React DOM"},
    @{Path="tailwindcss\package.json"; Label="Tailwind CSS"},
    @{Path="typescript\package.json"; Label="TypeScript"},
    @{Path="zustand\package.json"; Label="Zustand"},
    @{Path="postcss\package.json"; Label="PostCSS"},
    @{Path="lucide-react\package.json"; Label="Lucide React"},
    @{Path="clsx\package.json"; Label="clsx"},
    @{Path="autoprefixer\package.json"; Label="Autoprefixer"},
    @{Path="..\next\dist\bin\next"; Label="next CLI"}
  )
  
  $allOk = $true
  $rootNodeModules = Join-Path $root "node_modules"
  
  foreach ($check in $checks) {
    $fullPath = Join-Path $rootNodeModules $check.Path
    if (Test-Path $fullPath) {
      Write-Host "  [OK] $($check.Label)" -ForegroundColor Green
    } else {
      Write-Host "  [MISS] $($check.Label)" -ForegroundColor Red
      $allOk = $false
    }
  }
  
  if ($allOk) {
    Write-Host "`nAll packages verified! You can now run:" -ForegroundColor Green
    Write-Host "  npm run dev" -ForegroundColor White
    return $true
  } else {
    Write-Host "`nSome packages are missing. Try running this script again." -ForegroundColor Red
    return $false
  }
}

# --- Main ---
try {
  $npmSucceeded = $false
  
  if ($Mode -eq "npm-only") { $npmSucceeded = Install-Deps }
  elseif ($Mode -eq "manual") { Install-Manual }
  else {
    # auto: try npm first, fall back to manual
    if (-not (Install-Deps)) { Install-Manual }
  }
  
  Verify-Install
}
catch {
  Write-Host "Error: $_" -ForegroundColor Red
  exit 1
}
