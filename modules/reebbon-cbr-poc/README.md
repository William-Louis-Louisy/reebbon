# Reebbon CBR native POC

This module is a technical proof of concept for Issue #25. It is autolinkable,
but no application code imports it and CBR is not a product import format yet.

The POC proves this boundary:

```text
CBR file path
-> Expo Kotlin/Swift module on a background queue
-> shared C++ UnRAR 7.23 core
-> bounded extraction to a new temporary directory
-> future ImageDirectoryImportPipeline delegation in Issue #34
```

The archive and decompressed entries never cross the JavaScript boundary. The
native core rejects an entry before `RARProcessFileW` when its dictionary,
declared size, aggregate size, path, link metadata, encryption state, split
state, or entry count violates the configured policy. A second limit is applied
to bytes observed by the UnRAR callback while extraction is in progress.
UnRAR SMP workers are disabled to keep auxiliary native allocations predictable;
the platform bridge still runs all extraction away from the JS/UI thread.

The platform bridge creates a unique destination below its private temporary
cache root. The successful result exposes that path to the Images pipeline, and
`cleanup` refuses paths outside this root. The caller must invoke `cleanup` in a
`finally` block after the pipeline completes. Failed extraction removes the
directory inside the native core.

## Android build proof

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-cbr-poc-android.ps1
```

This compiles all four Android ABI variants with the project's NDK and CMake,
compiles the native safety-test executable for arm64, strips a measurement copy
of each shared library, and prints the binary sizes. A connected device is
required to execute the arm64 test binary.

## Apple build proof

The podspec compiles the same explicit UnRAR source list and C++ wrapper used by
Android, with an Objective-C++ bridge and an Expo Swift module. On macOS run:

```bash
npx expo prebuild --platform ios --clean --no-install
npx pod-install
xcodebuild -workspace ios/reebbon.xcworkspace -scheme reebbon \
  -configuration Release -sdk iphonesimulator build
```

No macOS/Xcode environment was available during Issue #25, so this remains a
required implementation validation for Issue #34 rather than a reason to reject
the architecture.
