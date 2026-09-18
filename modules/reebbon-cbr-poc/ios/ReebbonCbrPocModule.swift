import ExpoModulesCore
import Foundation

public final class ReebbonCbrPocModule: Module {
  private let extractionQueue = DispatchQueue(
    label: "com.bakerscript.reebbon.cbr-poc",
    qos: .userInitiated
  )

  public func definition() -> ModuleDefinition {
    Name("ReebbonCbrPoc")

    AsyncFunction("extract") { (sourcePath: String) throws -> [String: Any] in
      let destination = extractionRoot.appendingPathComponent(
        UUID().uuidString,
        isDirectory: true
      )
      var result = try ReebbonCbrPocBridge.extractSourcePath(
        sourcePath,
        destinationPath: destination.path
      ) as? [String: Any] ?? [:]
      result["directoryPath"] = destination.path
      return result
    }.runOnQueue(extractionQueue)

    AsyncFunction("cleanup") { (destinationPath: String) throws in
      let destination = URL(fileURLWithPath: destinationPath).standardizedFileURL
      let rootPath = extractionRoot.standardizedFileURL.path + "/"
      guard destination.path.hasPrefix(rootPath) else {
        throw NSError(
          domain: "ReebbonCbrPoc",
          code: 2,
          userInfo: [
            "code": "ERR_CBR_UNSAFE_CLEANUP",
            NSLocalizedDescriptionKey: "The cleanup path is outside the native CBR temporary root",
          ]
        )
      }
      try ReebbonCbrPocBridge.cleanupDestinationPath(destination.path)
    }.runOnQueue(extractionQueue)
  }

  private var extractionRoot: URL {
    FileManager.default.temporaryDirectory.appendingPathComponent(
      "reebbon-cbr-poc",
      isDirectory: true
    )
  }
}
