# Builds clap-plugin/soemdsp_dsp_proof.cpp -- links native_modules/
# basic_oscillator/basic_oscillator.cpp directly into the plugin as a
# second source file (real DSP code, no WASM) -- and installs a freshly
# numbered copy in the per-user CLAP folder, matching the build-number
# pattern from build_sandbox_gui_proof.ps1: never collides with a
# previous build's still-loaded (and therefore locked) DLL in a running
# DAW.
#
# Raw CLAP C API only -- no JUCE, no clap-wrapper, no WASM.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pluginDir = Join-Path $root "clap-plugin"
$clangxx = "C:\Program Files\LLVM\bin\clang++.exe"
$clapInclude = Join-Path $pluginDir "third_party\clap\include"
$oscillatorSource = Join-Path $root "native_modules\basic_oscillator\basic_oscillator.cpp"

if (-not (Test-Path $clapInclude)) {
    throw "CLAP headers not found at $clapInclude -- run: git clone --depth 1 https://github.com/free-audio/clap.git (into clap-plugin/third_party/clap)"
}
if (-not (Test-Path $oscillatorSource)) {
    throw "basic_oscillator.cpp not found at $oscillatorSource"
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
$sdkLibUm = Join-Path $sdkRoot "Lib\$($sdkVersion.Name)\um\x64"
$sdkLibUcrt = Join-Path $sdkRoot "Lib\$($sdkVersion.Name)\ucrt\x64"

$installDir = Join-Path $env:LOCALAPPDATA "Programs\Common\CLAP"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

$existing = Get-ChildItem $installDir -Filter "soemdsp_dsp_proof_*.clap" -ErrorAction SilentlyContinue |
    ForEach-Object {
        if ($_.BaseName -match "soemdsp_dsp_proof_(\d+)$") { [int]$Matches[1] } else { 0 }
    }
$buildNumber = if ($existing) { ($existing | Measure-Object -Maximum).Maximum + 1 } else { 1 }

Push-Location $pluginDir
try {
    & $clangxx -shared -std=c++17 -O2 `
        -I $clapInclude `
        -isystem $msvcInclude -isystem $sdkIncludeUcrt -isystem $sdkIncludeShared -isystem $sdkIncludeUm `
        -o soemdsp_dsp_proof.dll soemdsp_dsp_proof.cpp $oscillatorSource `
        -L $msvcLib -L $sdkLibUm -L $sdkLibUcrt
    if ($LASTEXITCODE -ne 0) { throw "clang++ build failed" }
} finally {
    Pop-Location
}

$installName = "soemdsp_dsp_proof_$buildNumber.clap"
Copy-Item (Join-Path $pluginDir "soemdsp_dsp_proof.dll") (Join-Path $installDir $installName) -Force

Write-Host ""
Write-Host "Built and installed: $installDir\$installName (build $buildNumber)"
Write-Host "Rescan plugins in your DAW -- look for `"soemdsp DSP Proof`"."
