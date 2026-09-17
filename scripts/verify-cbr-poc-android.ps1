param(
  [string]$AndroidSdk = "$env:LOCALAPPDATA\Android\Sdk",
  [string]$NdkVersion = "27.1.12297006",
  [string]$CmakeVersion = "3.22.1"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$sourceDirectory = Join-Path $repositoryRoot "modules\reebbon-cbr-poc\native"
$cmake = Join-Path $AndroidSdk "cmake\$CmakeVersion\bin\cmake.exe"
$ninja = Join-Path $AndroidSdk "cmake\$CmakeVersion\bin\ninja.exe"
$ndk = Join-Path $AndroidSdk "ndk\$NdkVersion"
$toolchain = Join-Path $ndk "build\cmake\android.toolchain.cmake"
$strip = Join-Path $ndk "toolchains\llvm\prebuilt\windows-x86_64\bin\llvm-strip.exe"

foreach ($requiredTool in @($cmake, $ninja, $toolchain, $strip)) {
  if (-not (Test-Path -LiteralPath $requiredTool)) {
    throw "Required Android build tool is missing: $requiredTool"
  }
}

$results = @()
foreach ($abi in @("armeabi-v7a", "arm64-v8a", "x86", "x86_64")) {
  $buildDirectory = Join-Path $repositoryRoot "android\.cxx\cbr-poc-$abi"
  $testFlag = if ($abi -eq "arm64-v8a") { "ON" } else { "OFF" }
  & $cmake `
    -S $sourceDirectory `
    -B $buildDirectory `
    -G Ninja `
    "-DCMAKE_MAKE_PROGRAM=$ninja" `
    "-DCMAKE_TOOLCHAIN_FILE=$toolchain" `
    "-DANDROID_ABI=$abi" `
    -DANDROID_PLATFORM=android-24 `
    "-DANDROID_NDK=$ndk" `
    -DCMAKE_BUILD_TYPE=Release `
    "-DREEBBON_CBR_BUILD_NATIVE_TESTS=$testFlag"
  if ($LASTEXITCODE -ne 0) {
    throw "CMake configuration failed for $abi"
  }

  & $cmake --build $buildDirectory --target reebbon-cbr-poc
  if ($LASTEXITCODE -ne 0) {
    throw "Native module build failed for $abi"
  }
  if ($abi -eq "arm64-v8a") {
    & $cmake --build $buildDirectory --target reebbon-cbr-native-tests
    if ($LASTEXITCODE -ne 0) {
      throw "Native safety-test build failed for $abi"
    }
  }

  $library = Join-Path $buildDirectory "libreebbon-cbr-poc.so"
  $strippedLibrary = Join-Path $buildDirectory "libreebbon-cbr-poc-stripped.so"
  & $strip -o $strippedLibrary $library
  if ($LASTEXITCODE -ne 0) {
    throw "Native module strip failed for $abi"
  }
  $results += [PSCustomObject]@{
    ABI = $abi
    UnstrippedBytes = (Get-Item -LiteralPath $library).Length
    StrippedBytes = (Get-Item -LiteralPath $strippedLibrary).Length
  }
}

$results | Format-Table -AutoSize
