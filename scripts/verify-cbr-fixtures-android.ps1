param(
  [string]$AndroidSdk = "$env:LOCALAPPDATA\Android\Sdk",
  [string]$Serial = ""
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$adb = Join-Path $AndroidSdk "platform-tools\adb.exe"
$runner = Join-Path $repositoryRoot "android\.cxx\cbr-native-x86_64\reebbon-cbr-fixture-runner"
$safetyTests = Join-Path $repositoryRoot "android\.cxx\cbr-native-x86_64\reebbon-cbr-native-tests"
$fixtureRoot = Join-Path $repositoryRoot "android\.cxx\cbr-fixtures"
$remoteRoot = "/data/local/tmp/reebbon-cbr-tests"
$libarchiveCommit = "5ddc1d9822a390424ce5bd42f35e58acc9e88df4"

if (-not (Test-Path -LiteralPath $adb)) {
  throw "adb is missing: $adb"
}
if (-not (Test-Path -LiteralPath $runner)) {
  throw "Build the x86_64 native fixture runner first: scripts/verify-cbr-native-android.ps1"
}
if (-not (Test-Path -LiteralPath $safetyTests)) {
  throw "Build the x86_64 native safety tests first: scripts/verify-cbr-native-android.ps1"
}

$adbArguments = if ($Serial.Trim().Length -eq 0) { @() } else { @("-s", $Serial) }
$devices = & $adb @adbArguments get-state 2>$null
if ($LASTEXITCODE -ne 0 -or $devices -notcontains "device") {
  throw "No ready Android device or emulator is available."
}

$fixtures = @(
  @{ Name = "rar4-basic"; File = "test_read_format_rar_binary_data.rar"; Expected = "OK" },
  @{ Name = "rar4-corrupt"; File = "test_read_format_rar_invalid1.rar"; Expected = "ERR_CBR_CORRUPTED_ARCHIVE" },
  @{ Name = "rar4-encrypted"; File = "test_read_format_rar_encryption_data.rar"; Expected = "ERR_CBR_ENCRYPTED_ARCHIVE" },
  @{ Name = "rar5-basic"; File = "test_read_format_rar5_stored.rar"; Expected = "OK" },
  @{ Name = "rar5-solid"; File = "test_read_format_rar5_solid.rar"; Expected = "OK" },
  @{ Name = "rar5-corrupt"; File = "test_read_format_rar5_truncated_huff.rar"; Expected = "ERR_CBR_CORRUPTED_ARCHIVE" },
  @{ Name = "rar5-encrypted"; File = "test_read_format_rar5_encrypted.rar"; Expected = "ERR_CBR_ENCRYPTED_ARCHIVE" },
  @{ Name = "rar5-multivolume"; File = "test_read_format_rar5_multiarchive.part01.rar"; Expected = "ERR_CBR_MULTIVOLUME_UNSUPPORTED" },
  @{ Name = "rar5-link"; File = "test_read_format_rar5_symlink.rar"; Expected = "ERR_CBR_LINK_UNSUPPORTED" }
)

function Decode-UuencodedFile {
  param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [Parameter(Mandatory = $true)][string]$OutputPath
  )

  $lines = Get-Content -LiteralPath $InputPath
  $begin = [Array]::FindIndex(
    $lines,
    [Predicate[string]] { param($line) $line.StartsWith("begin ") }
  )
  if ($begin -lt 0) {
    throw "Invalid uuencoded fixture: $InputPath"
  }

  $bytes = [System.Collections.Generic.List[byte]]::new()
  for ($lineIndex = $begin + 1; $lineIndex -lt $lines.Count; $lineIndex += 1) {
    $line = $lines[$lineIndex]
    if ($line -eq "end") {
      break
    }
    if ($line.Length -eq 0) {
      continue
    }
    $remaining = (([int][char]$line[0]) - 32) -band 63
    $position = 1
    while ($remaining -gt 0) {
      $values = @(0, 0, 0, 0)
      for ($valueIndex = 0; $valueIndex -lt 4; $valueIndex += 1) {
        if ($position -lt $line.Length) {
          $values[$valueIndex] = (([int][char]$line[$position]) - 32) -band 63
          $position += 1
        }
      }
      $firstByte = (($values[0] -shl 2) -bor ($values[1] -shr 4)) -band 255
      $secondByte = (($values[1] -shl 4) -bor ($values[2] -shr 2)) -band 255
      $thirdByte = (($values[2] -shl 6) -bor $values[3]) -band 255
      $decoded = @($firstByte, $secondByte, $thirdByte)
      $take = [Math]::Min(3, $remaining)
      for ($byteIndex = 0; $byteIndex -lt $take; $byteIndex += 1) {
        $bytes.Add([byte]$decoded[$byteIndex])
      }
      $remaining -= $take
    }
  }
  [IO.File]::WriteAllBytes($OutputPath, $bytes.ToArray())
}

New-Item -ItemType Directory -Force -Path $fixtureRoot | Out-Null
foreach ($fixture in $fixtures) {
  $encodedPath = Join-Path $fixtureRoot "$($fixture.File).uu"
  $archivePath = Join-Path $fixtureRoot $fixture.File
  $url = "https://raw.githubusercontent.com/libarchive/libarchive/$libarchiveCommit/libarchive/test/$($fixture.File).uu"
  Invoke-WebRequest -Uri $url -OutFile $encodedPath
  Decode-UuencodedFile -InputPath $encodedPath -OutputPath $archivePath
}

try {
  & $adb @adbArguments shell mkdir -p $remoteRoot
  & $adb @adbArguments push $runner "$remoteRoot/reebbon-cbr-fixture-runner"
  & $adb @adbArguments push $safetyTests "$remoteRoot/reebbon-cbr-native-tests"
  & $adb @adbArguments shell chmod 755 "$remoteRoot/reebbon-cbr-fixture-runner"
  & $adb @adbArguments shell chmod 755 "$remoteRoot/reebbon-cbr-native-tests"
  & $adb @adbArguments shell "$remoteRoot/reebbon-cbr-native-tests"
  if ($LASTEXITCODE -ne 0) {
    throw "Native CBR path and limit safety tests failed."
  }

  foreach ($fixture in $fixtures) {
    $archivePath = Join-Path $fixtureRoot $fixture.File
    $remoteArchive = "$remoteRoot/$($fixture.File)"
    $remoteDestination = "$remoteRoot/output-$($fixture.Name)"
    & $adb @adbArguments push $archivePath $remoteArchive
    & $adb @adbArguments shell "$remoteRoot/reebbon-cbr-fixture-runner" $remoteArchive $remoteDestination $fixture.Expected
    if ($LASTEXITCODE -ne 0) {
      throw "Native CBR fixture failed: $($fixture.Name)"
    }
  }
} finally {
  & $adb @adbArguments shell rm -rf $remoteRoot
}
