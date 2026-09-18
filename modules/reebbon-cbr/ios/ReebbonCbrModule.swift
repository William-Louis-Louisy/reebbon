import ExpoModulesCore
import Foundation

public final class ReebbonCbrModule: Module {
  private let extractionQueue = DispatchQueue(
    label: "com.bakerscript.reebbon.cbr",
    qos: .userInitiated
  )

  public func definition() -> ModuleDefinition {
    Name("ReebbonCbr")

    AsyncFunction("extract") {
      (sourceUri: String, extractionId: String) throws -> [String: Any] in
      let job = try self.ownedJob(extractionId)
      guard !FileManager.default.fileExists(atPath: job.path) else {
        throw self.codedError(
          "ERR_CBR_DESTINATION_EXISTS",
          "The native CBR import directory already exists"
        )
      }

      do {
        try FileManager.default.createDirectory(
          at: job,
          withIntermediateDirectories: true
        )
        let localSource = try self.acquireSource(
          sourceUri,
          destination: job.appendingPathComponent("source.cbr")
        )
        let destination = job.appendingPathComponent(
          "extracted",
          isDirectory: true
        )
        let nativeResult: [String: Any]
        do {
          nativeResult = try ReebbonCbrBridge.extractSourcePath(
            localSource.path,
            destinationPath: destination.path
          ) as? [String: Any] ?? [:]
        } catch let error as NSError {
          let code = error.userInfo["code"] as? String ?? "ERR_CBR_NATIVE"
          throw self.codedError(code, error.localizedDescription, cause: error)
        }
        var result = nativeResult
        try FileManager.default.removeItem(at: localSource)
        result["directoryUri"] = destination.absoluteString
        return result
      } catch {
        try? FileManager.default.removeItem(at: job)
        throw error
      }
    }.runOnQueue(extractionQueue)

    AsyncFunction("cleanup") { (extractionId: String) throws in
      let job = try self.ownedJob(extractionId)
      if FileManager.default.fileExists(atPath: job.path) {
        do {
          try FileManager.default.removeItem(at: job)
        } catch {
          throw self.codedError(
            "ERR_CBR_CLEANUP",
            "The temporary CBR import directory could not be removed",
            cause: error
          )
        }
      }
    }.runOnQueue(extractionQueue)
  }

  private func acquireSource(_ sourceUri: String, destination: URL) throws -> URL {
    let source: URL
    if let parsed = URL(string: sourceUri), parsed.isFileURL {
      source = parsed
    } else if !sourceUri.contains("://") {
      source = URL(fileURLWithPath: sourceUri)
    } else {
      throw codedError(
        "ERR_CBR_SOURCE_ACCESS",
        "The selected CBR URI scheme is not supported"
      )
    }

    let securityAccess = source.startAccessingSecurityScopedResource()
    defer {
      if securityAccess {
        source.stopAccessingSecurityScopedResource()
      }
    }

    do {
      let values = try source.resourceValues(forKeys: [.fileSizeKey])
      guard let fileSize = values.fileSize, fileSize >= 0 else {
        throw codedError(
          "ERR_CBR_SOURCE_ACCESS",
          "The selected CBR archive size is unavailable"
        )
      }
      if UInt64(fileSize) > ReebbonCbrBridge.maximumArchiveBytes() {
        throw codedError(
          "ERR_CBR_ARCHIVE_SIZE_LIMIT",
          "The CBR archive exceeds the native input size limit"
        )
      }
      try FileManager.default.copyItem(at: source, to: destination)
      return destination
    } catch let error as CodedError where error.code.hasPrefix("ERR_CBR_") {
      throw error
    } catch {
      throw codedError(
        "ERR_CBR_SOURCE_ACCESS",
        "The selected CBR archive could not be copied locally",
        cause: error
      )
    }
  }

  private func ownedJob(_ extractionId: String) throws -> URL {
    let range = extractionId.range(
      of: "^[A-Za-z0-9][A-Za-z0-9._-]*$",
      options: .regularExpression
    )
    guard range?.lowerBound == extractionId.startIndex,
          range?.upperBound == extractionId.endIndex else {
      throw codedError(
        "ERR_CBR_UNSAFE_CLEANUP",
        "The CBR extraction identifier is invalid"
      )
    }

    let root = extractionRoot.standardizedFileURL
    let job = root.appendingPathComponent(
      extractionId,
      isDirectory: true
    ).standardizedFileURL
    guard job.path.hasPrefix(root.path + "/") else {
      throw codedError(
        "ERR_CBR_UNSAFE_CLEANUP",
        "The CBR import path is outside its native temporary root"
      )
    }
    return job
  }

  private func codedError(
    _ code: String,
    _ message: String,
    cause: Error? = nil
  ) -> Exception {
    let error = Exception(
      name: "ReebbonCbrException",
      description: message,
      code: code
    )
    error.cause = cause
    return error
  }

  private var extractionRoot: URL {
    FileManager.default.temporaryDirectory.appendingPathComponent(
      "reebbon-cbr",
      isDirectory: true
    )
  }
}
