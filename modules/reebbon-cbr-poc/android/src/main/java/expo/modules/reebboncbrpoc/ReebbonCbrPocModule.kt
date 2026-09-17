package expo.modules.reebboncbrpoc

import android.content.Context
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

class ReebbonCbrPocModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  init {
    System.loadLibrary("reebbon-cbr-poc")
  }

  override fun definition() = ModuleDefinition {
    Name("ReebbonCbrPoc")

    AsyncFunction("extract") Coroutine { sourcePath: String ->
      withContext(Dispatchers.IO) {
        val destination = File(
          File(context.cacheDir, "reebbon-cbr-poc"),
          UUID.randomUUID().toString(),
        )
        val destinationPath = destination.absolutePath
        val values = nativeCall { extractNative(sourcePath, destinationPath) }
        mapOf(
          "directoryPath" to destinationPath,
          "entryCount" to values[0],
          "fileCount" to values[1],
          "totalBytes" to values[2],
          "solid" to (values[3] == 1L),
        )
      }
    }

    AsyncFunction("cleanup") Coroutine { destinationPath: String ->
      withContext(Dispatchers.IO) {
        nativeCall { cleanupNative(ownedDestination(destinationPath).absolutePath) }
      }
    }
  }

  private external fun extractNative(sourcePath: String, destinationPath: String): LongArray
  private external fun cleanupNative(destinationPath: String)

  private fun ownedDestination(destinationPath: String): File {
    val root = File(context.cacheDir, "reebbon-cbr-poc").canonicalFile
    val destination = File(destinationPath).canonicalFile
    if (destination == root || !destination.path.startsWith(root.path + File.separator)) {
      throw CodedException(
        "ERR_CBR_UNSAFE_CLEANUP",
        "The cleanup path is outside the native CBR temporary root",
      )
    }
    return destination
  }

  private fun <T> nativeCall(block: () -> T): T = try {
    block()
  } catch (error: IllegalStateException) {
    val (code, message) = error.message
      ?.split('|', limit = 2)
      ?.let { parts -> parts.first() to parts.getOrElse(1) { parts.first() } }
      ?: ("ERR_CBR_NATIVE" to "The native CBR POC failed")
    throw CodedException(code, message, error)
  }
}
