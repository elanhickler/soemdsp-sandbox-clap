# Builds clap-plugin/soemdsp_minimal.cpp into a native Windows .clap plugin
# and installs it into the standard per-user CLAP folder so any CLAP host
# picks it up on its next plugin rescan. No admin rights needed.
#
# Raw CLAP C API only -- no JUCE, no clap-wrapper. Headers come from the
# clap-plugin/third_party/clap submodule (headers only).
#
# Requires: the same LLVM/clang install already used for native_modules/,
# plus an installed MSVC toolset + Windows SDK (for import libs only --
# this does not use MSVC's compiler, just its .lib files via lld-link).

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pluginDir = Join-Path $root "clap-plugin"
$clangxx = "C:\Program Files\LLVM\bin\clang++.exe"
$clapInclude = Join-Path $pluginDir "third_party\clap\include"

if (-not (Test-Path $clapInclude)) {
    throw "CLAP headers not found at $clapInclude -- run: git submodule update --init clap-plugin/third_party/clap"
}

# Locate the newest installed MSVC toolset and Windows SDK (headers + import libs only).
$msvcRoot = Get-ChildItem "C:\Program Files\Microsoft Visual Studio\2022\*\VC\Tools\MSVC" -Directory -ErrorAction Stop |
    Select-Object -First 1
$msvcVersion = Get-ChildItem $msvcRoot.FullName -Directory | Sort-Object Name -Descending | Select-Object -First 1
$msvcInclude = Join-Path $msvcVersion.FullName "include"
$msvcLib = Join-Path $msvcVersion.FullName "lib\x64"

$sdkRoot = "C:\Program Files (x86)\Windows Kits\10"
$sdkVersion = Get-ChildItem (Join-Path $sdkRoot "Lib") -Directory | Sort-Object Name -Descending | Select-Object -First 1
$sdkIncludeUcrt = Join-Path $sdkRoot "Include\$($sdkVersion.Name)\ucrt"
$sdkIncludeShared = Join-Path $sdkRoot "Include\$($sdkVersion.Name)\shared"
$sdkIncludeUm = Join-Path $sdkRoot "Include\$($sdkVersion.Name)\um"
$sdkLibUm = Join-Path $sdkRoot "Lib\$($sdkVersion.Name)\um\x64"
$sdkLibUcrt = Join-Path $sdkRoot "Lib\$($sdkVersion.Name)\ucrt\x64"

Push-Location $pluginDir
try {
    & $clangxx -shared -std=c++17 -O2 `
        -I $clapInclude `
        -isystem $msvcInclude -isystem $sdkIncludeUcrt -isystem $sdkIncludeShared -isystem $sdkIncludeUm `
        -o soemdsp_minimal.dll soemdsp_minimal.cpp `
        -L $msvcLib -L $sdkLibUm -L $sdkLibUcrt
    if ($LASTEXITCODE -ne 0) { throw "clang++ build failed" }
} finally {
    Pop-Location
}

$installDir = Join-Path $env:LOCALAPPDATA "Programs\Common\CLAP"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Copy-Item (Join-Path $pluginDir "soemdsp_minimal.dll") (Join-Path $installDir "soemdsp_minimal.clap") -Force

Write-Host ""
Write-Host "Built and installed: $installDir\soemdsp_minimal.clap"
Write-Host "Rescan plugins in your DAW to pick it up."
