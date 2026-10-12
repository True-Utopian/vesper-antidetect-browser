[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$vesperRoot=Split-Path -Parent $PSScriptRoot
$vesperOutput=Join-Path $vesperRoot '.workbench/kernel-toolchain/surface-policy-tests'
New-Item -ItemType Directory -Force -Path $vesperOutput | Out-Null
$vesperClang='C:/vesper-kernel/src/third_party/llvm-build/Release+Asserts/bin/clang-cl.exe'
$vesperMSVC='C:/Program Files (x86)/Microsoft Visual Studio/18/BuildTools/VC/Tools/MSVC/14.50.35717'
$vesperSDK='C:/Program Files (x86)/Windows Kits/10'
$vesperSDKVersion='10.0.26100.0'
$vesperPreviousInclude=$env:INCLUDE; $vesperPreviousLib=$env:LIB
try {
  $env:INCLUDE="$vesperMSVC/include;$vesperSDK/Include/$vesperSDKVersion/ucrt;$vesperSDK/Include/$vesperSDKVersion/shared;$vesperSDK/Include/$vesperSDKVersion/um"
  $env:LIB="$vesperMSVC/lib/x64;$vesperSDK/Lib/$vesperSDKVersion/ucrt/x64;$vesperSDK/Lib/$vesperSDKVersion/um/x64"
  $vesperSource=Join-Path $vesperRoot 'native/chromium/policies/vesper_surface_algorithms_test.cc'
  $vesperExecutable=Join-Path $vesperOutput 'surface-policy-tests.exe'
  & $vesperClang /nologo /std:c++20 /EHsc /MD /W4 /WX $vesperSource "/Fe:$vesperExecutable" "/Fo:$(Join-Path $vesperOutput 'surface-policy-tests.obj')" *> (Join-Path $vesperOutput 'compile.log')
  if($LASTEXITCODE -ne 0){throw 'Standalone policy compilation failed; inspect compile.log'}
  & $vesperExecutable > (Join-Path $vesperOutput 'result.json')
  if($LASTEXITCODE -ne 0){throw 'Standalone policy vectors failed'}
  Get-Content -LiteralPath (Join-Path $vesperOutput 'result.json') -Raw
}finally{$env:INCLUDE=$vesperPreviousInclude;$env:LIB=$vesperPreviousLib}
