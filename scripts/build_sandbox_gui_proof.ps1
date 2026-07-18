# Builds clap-plugin/soemdsp_sandbox_gui_proof.cpp and installs it as a
# freshly-numbered copy in the per-user CLAP folder, e.g.
# soemdsp_sandbox_gui_proof_3.clap. No admin rights needed.
#
# Each build gets its own plugin id/name (baked in via -DSOEMDSP_BUILD_NUMBER)
# and its own install filename, so re-running this during dev iteration never
# collides with a previous build's still-loaded (and therefore locked) DLL in
# a running DAW -- just rescan and load the newest-numbered copy. Old copies
# are left in place; delete them by hand once you're done iterating.
#
# Raw CLAP C API only -- no JUCE, no clap-wrapper. Requires the same
# clang++/MSVC-toolset/Windows-SDK setup as build_clap_plugin.ps1, plus the
# WebView2 SDK vendored in clap-plugin/third_party/webview2/.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pluginDir = Join-Path $root "clap-plugin"
$clangxx = "C:\Program Files\LLVM\bin\clang++.exe"
$clapInclude = Join-Path $pluginDir "third_party\clap\include"
$webview2Lib = Join-Path $pluginDir "third_party\webview2\x64"

if (-not (Test-Path $clapInclude)) {
    throw "CLAP headers not found at $clapInclude -- run: git submodule update --init clap-plugin/third_party/clap"
}

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
$sdkIncludeWinrt = Join-Path $sdkRoot "Include\$($sdkVersion.Name)\winrt"
$sdkLibUm = Join-Path $sdkRoot "Lib\$($sdkVersion.Name)\um\x64"
$sdkLibUcrt = Join-Path $sdkRoot "Lib\$($sdkVersion.Name)\ucrt\x64"

$installDir = Join-Path $env:LOCALAPPDATA "Programs\Common\CLAP"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

# Next build number = 1 + highest already installed, so this is safe to
# re-run any number of times without ever reusing an id/filename.
$existing = Get-ChildItem $installDir -Filter "soemdsp_sandbox_gui_proof_*.clap" -ErrorAction SilentlyContinue |
    ForEach-Object {
        if ($_.BaseName -match "soemdsp_sandbox_gui_proof_(\d+)$") { [int]$Matches[1] } else { 0 }
    }
$buildNumber = if ($existing) { ($existing | Measure-Object -Maximum).Maximum + 1 } else { 1 }

Push-Location $pluginDir
try {
    & $clangxx -shared -std=c++17 -O2 "-DSOEMDSP_BUILD_NUMBER=$buildNumber" `
        -I $clapInclude -I . `
        -isystem $msvcInclude -isystem $sdkIncludeUcrt -isystem $sdkIncludeShared -isystem $sdkIncludeUm -isystem $sdkIncludeWinrt `
        -o soemdsp_sandbox_gui_proof.dll soemdsp_sandbox_gui_proof.cpp `
        -L $msvcLib -L $sdkLibUm -L $sdkLibUcrt -L $webview2Lib `
        -lWebView2LoaderStatic -lole32 -luser32 -ladvapi32 -lws2_32
    if ($LASTEXITCODE -ne 0) { throw "clang++ build failed" }
} finally {
    Pop-Location
}

$installName = "soemdsp_sandbox_gui_proof_$buildNumber.clap"
Copy-Item (Join-Path $pluginDir "soemdsp_sandbox_gui_proof.dll") (Join-Path $installDir $installName) -Force

Write-Host ""
Write-Host "Built and installed: $installDir\$installName (build $buildNumber)"
Write-Host "Rescan plugins in your DAW -- look for `"soemdsp Sandbox GUI Proof (build $buildNumber)`"."
