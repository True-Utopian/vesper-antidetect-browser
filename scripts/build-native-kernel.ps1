[CmdletBinding()]
param(
  [ValidateSet('Doctor', 'Sync', 'Patch', 'Generate', 'Build', 'Test')]
  [string]$Stage = 'Doctor',
  [string]$Checkout = 'C:\vesper-kernel',
  [ValidateRange(1, 8)][int]$Jobs = 2,
  [ValidateSet('chrome', 'blink_common_unittests', 'blink_platform_unittests')]
  [string[]]$Targets = @('chrome')
)
$ErrorActionPreference = 'Stop'
$vesperRoot = Split-Path -Parent $PSScriptRoot
$vesperManifest = Get-Content -LiteralPath (Join-Path $vesperRoot 'native/chromium/kernel.json') -Raw | ConvertFrom-Json
$vesperCheckout = [IO.Path]::GetFullPath($Checkout)
if ($vesperCheckout -match '[\r\n"&|<>%!]') { throw 'Checkout contains unsupported command characters' }
$vesperSource = Join-Path $vesperCheckout 'src'
$vesperDepot = Join-Path $vesperCheckout 'depot_tools'
$vesperLogs = Join-Path $vesperRoot '.workbench/kernel-toolchain'
New-Item -ItemType Directory -Force -Path $vesperLogs | Out-Null
$env:PATH = "$vesperDepot;$env:PATH"
$env:DEPOT_TOOLS_WIN_TOOLCHAIN = '0'
$env:DEPOT_TOOLS_UPDATE = '0'
$env:vs2026_install = 'C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools'
$env:GIT_CONFIG_COUNT = '3'
$env:GIT_CONFIG_KEY_0 = 'core.autocrlf'; $env:GIT_CONFIG_VALUE_0 = 'false'
$env:GIT_CONFIG_KEY_1 = 'core.longpaths'; $env:GIT_CONFIG_VALUE_1 = 'true'
$env:GIT_CONFIG_KEY_2 = 'core.fscache'; $env:GIT_CONFIG_VALUE_2 = 'true'
$env:GIT_TERMINAL_PROMPT = '0'

function Invoke-VesperTool {
  param([string]$File, [string[]]$Arguments)
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$File failed with exit code $LASTEXITCODE" }
}

function Invoke-VesperNativeSuite {
  param([string]$Executable, [string]$Name, [string[]]$Arguments, [int]$Expected)
  $vesperXml = Join-Path $vesperLogs "$Name.xml"
  Invoke-VesperTool $Executable ($Arguments + @("--gtest_output=xml:$vesperXml"))
  [xml]$vesperTestResults = Get-Content -LiteralPath $vesperXml -Raw
  if ([int]$vesperTestResults.testsuites.tests -ne $Expected -or [int]$vesperTestResults.testsuites.failures -ne 0) {
    throw "Native suite $Name did not execute the expected $Expected passing tests"
  }
}

if (!(Test-Path -LiteralPath $vesperSource) -or !(Test-Path -LiteralPath (Join-Path $vesperDepot 'gclient.bat'))) {
  throw 'Create the pinned official Chromium checkout and depot_tools before using this helper. It never resets an existing checkout.'
}
$vesperHead = (& git -C $vesperSource rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $vesperHead -ne $vesperManifest.revision) { throw 'Chromium HEAD does not match the pinned kernel revision' }
$vesperDrive = Get-PSDrive -Name ([IO.Path]::GetPathRoot($vesperCheckout).Substring(0, 1))
$vesperRecord = [ordered]@{
  at = [DateTime]::UtcNow.ToString('o'); author = 'true-utopian'; stage = $Stage
  source = $vesperSource; revision = $vesperHead; jobs = $Jobs
  freeBytes = $vesperDrive.Free; customKernelCompiled = $false
}
Push-Location $vesperSource
try {
  if ($Stage -eq 'Doctor') {
    Invoke-VesperTool (Join-Path $vesperDepot 'python3.bat') @('build/vs_toolchain.py', 'get_toolchain_dir')
    Invoke-VesperTool (Join-Path $vesperDepot 'python3.bat') @('build/toolchain/win/setup_toolchain.py', $env:vs2026_install, 'C:\Program Files (x86)\Windows Kits\10', 'C:\Windows\System32;C:\Windows\SysWOW64;Arm64Unused', 'win', 'x64', 'none')
    $vesperRecord.status = 'toolchain-validated'
  } elseif ($Stage -eq 'Sync') {
    Push-Location $vesperCheckout
    try { Invoke-VesperTool (Join-Path $vesperDepot 'gclient.bat') @('sync', '--nohooks', '--no-history', '--shallow', "-j$Jobs", '--revision', "src@$($vesperManifest.revision)") }
    finally { Pop-Location }
    $vesperRecord.status = 'dependencies-synchronized'
  } elseif ($Stage -eq 'Patch') {
    $vesperPatches = @()
    foreach ($vesperPatchName in $vesperManifest.patches) {
      $vesperPatch = Join-Path $vesperRoot "native/chromium/patches/$vesperPatchName"
      if (!(Test-Path -LiteralPath $vesperPatch)) { throw "Missing original kernel patch: $vesperPatchName" }
      & git apply --reverse --check -- $vesperPatch 2>$null
      if ($LASTEXITCODE -ne 0) {
        Invoke-VesperTool 'git' @('apply', '--check', '--', $vesperPatch)
        Invoke-VesperTool 'git' @('apply', '--', $vesperPatch)
      }
      $vesperPatches += @{ name = $vesperPatchName; sha256 = (Get-FileHash -LiteralPath $vesperPatch -Algorithm SHA256).Hash.ToLowerInvariant() }
    }
    Invoke-VesperTool 'git' @('diff', '--check')
    $vesperRecord.patches = $vesperPatches
    $vesperRecord.status = 'patches-applied'
  } elseif ($Stage -eq 'Generate') {
    # Hooks provide pinned clang/GN/sysroots/resources. Compilation remains local.
    Push-Location $vesperCheckout
    try { Invoke-VesperTool (Join-Path $vesperDepot 'gclient.bat') @('runhooks') }
    finally { Pop-Location }
    $vesperOutput = Join-Path $vesperSource 'out/Vesper'
    New-Item -ItemType Directory -Force -Path $vesperOutput | Out-Null
    $vesperGnArgs = foreach ($vesperProperty in $vesperManifest.gnArgs.PSObject.Properties) {
      $vesperValue = if ($vesperProperty.Value -is [bool]) { $vesperProperty.Value.ToString().ToLowerInvariant() } elseif ($vesperProperty.Value -is [string]) { '"' + $vesperProperty.Value + '"' } else { [string]$vesperProperty.Value }
      "$($vesperProperty.Name) = $vesperValue"
    }
    [IO.File]::WriteAllLines((Join-Path $vesperOutput 'args.gn'), $vesperGnArgs)
    Invoke-VesperTool (Join-Path $vesperDepot 'gn.bat') @('gen', 'out/Vesper', '--fail-on-unused-args')
    $vesperRecord.status = 'build-generated'
  } elseif ($Stage -eq 'Build') {
    if ($vesperDrive.Free -lt 20GB) { throw 'Less than 20 GiB available before compilation. No files were removed.' }
    if (!(Test-Path -LiteralPath 'out/Vesper/build.ninja')) { throw 'Run Patch and Generate first' }
    Invoke-VesperTool (Join-Path $vesperDepot 'autoninja.bat') (@('-C', 'out/Vesper') + $Targets + @("-j$Jobs"))
    $vesperExecutable = Join-Path $vesperSource 'out/Vesper/chrome.exe'
    if (!(Test-Path -LiteralPath $vesperExecutable)) { throw 'Build returned without a Chromium executable' }
    $vesperRecord.customKernelCompiled = $true
    $vesperRecord.executable = $vesperExecutable
    $vesperRecord.executableSha256 = (Get-FileHash -LiteralPath $vesperExecutable -Algorithm SHA256).Hash.ToLowerInvariant()
    $vesperRecord.status = 'compiled-awaiting-native-qualification'
  } elseif ($Stage -eq 'Test') {
    Invoke-VesperNativeSuite '.\out\Vesper\blink_common_unittests.exe' 'upstream-memory-regression' @('--gtest_filter=ApproximatedDeviceMemoryTest.*') 1
    Invoke-VesperNativeSuite '.\out\Vesper\blink_common_unittests.exe' 'scalars-default' @('--gtest_filter=VesperNativeScalarPolicyTest.*') 8
    Invoke-VesperNativeSuite '.\out\Vesper\blink_common_unittests.exe' 'scalars-policy' @('--gtest_filter=VesperNativeScalarPolicyTest.*', '--vesper-hardware-concurrency=3', '--vesper-device-memory=4') 8
    Invoke-VesperNativeSuite '.\out\Vesper\blink_platform_unittests.exe' 'canvas' @('--gtest_filter=VesperCanvasReadbackTest.*') 9
    $vesperRecord.nativeTestExecutions = 26
    $vesperRecord.status = 'native-unit-tests-passed'
  }
} catch {
  $vesperRecord.status = 'failed'; $vesperRecord.error = $_.Exception.Message
  throw
} finally {
  Pop-Location
  $vesperRecord | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $vesperLogs "$($Stage.ToLowerInvariant())-result.json") -Encoding utf8
}
