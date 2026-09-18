# Reebbon CBR native module

This local Expo module implements the product CBR extraction boundary for
IMP-08. It uses the vendored official UnRAR 7.23 source on Android and iOS.

```text
local CBR URI
-> bounded native source copy
-> Kotlin/Swift module on a background queue
-> shared C++ UnRAR core
-> private temporary directory
-> ImageDirectoryImportPipeline
-> Images book
```

Only the source URI, extraction identifier, output directory URI, and numeric
metrics cross the JavaScript boundary. Archive bytes and decompressed image
bytes never enter the JavaScript heap. The application importer delegates image
selection, natural ordering, validation, cover selection, staging, persistence,
and compensation to `ImageDirectoryImportPipeline`.

## Native policy

The module enforces these limits before or during extraction:

- input archive: 2 GiB;
- dictionary: 64 MiB;
- one entry: 512 MiB;
- all decompressed entries: 4 GiB;
- entries: 10,000;
- archive path: 1,024 characters.

Absolute paths, traversal, empty path components, case-insensitive collisions,
links/redirections, encrypted entries or headers, and split/multi-volume
archives are rejected. The native destination must not already exist and is
removed on every extraction failure. The application calls `cleanup` after the
shared Images pipeline has staged the extracted files.

UnRAR SMP workers are disabled so the dominant native allocation remains the
bounded decompression dictionary. Android source acquisition uses a 64 KiB
buffer from `content://` or local files into the module's private cache. iOS
copies a security-scoped local file into the module's private temporary root.

## Android validation

Compile all supported ABIs and the native safety/fixture executables with the
project NDK:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-cbr-native-android.ps1
```

With a booted x86_64 emulator, execute the pinned upstream RAR4/RAR5 corpus:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-cbr-fixtures-android.ps1
```

The corpus covers valid RAR4, valid RAR5, RAR5 solid, corrupt RAR4/RAR5,
encrypted RAR4/RAR5, multi-volume RAR5, and a RAR5 symbolic link. Path traversal
and configured limit boundaries are covered by the native safety executable.

For application/device memory QA, use a development client containing this
module and capture both process memory and native checkpoints while importing a
large CBR:

```powershell
adb logcat -c
adb logcat -v threadtime ReebbonCbrMemory:I ReactNativeJS:I *:S
adb shell dumpsys meminfo com.bakerscript.reebbon
```

The `ReebbonCbrMemory` tag reports source acquisition and extraction checkpoints.
Repeat `dumpsys meminfo` before selection, during extraction, after staging, and
after return to the library. Verify that the private `reebbon-cbr/<id>` directory
does not remain after success, cancellation, or failure.

## Apple validation

The podspec compiles the same explicit UnRAR source list and C++ wrapper as
Android, with an Objective-C++ bridge and an Expo Swift module. On macOS run:

```bash
npx expo prebuild --platform ios --clean --no-install
npx pod-install
xcodebuild -workspace ios/reebbon.xcworkspace -scheme reebbon \
  -configuration Release -sdk iphonesimulator build
```

An iOS development build and physical-device import corpus remain mandatory
before release when no macOS/Xcode environment is available during development.
