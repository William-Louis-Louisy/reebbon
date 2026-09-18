package expo.modules.reebboncbr

import android.content.Context
import android.net.Uri
import android.os.Debug
import android.util.Log
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream

class ReebbonCbrModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  init {
    System.loadLibrary("reebbon-cbr")
  }

  override fun definition() = ModuleDefinition {
    Name("ReebbonCbr")

    AsyncFunction("extract") Coroutine { sourceUri: String, extractionId: String ->
      withContext(Dispatchers.IO) {
        extractArchive(sourceUri, extractionId)
      }
    }

    AsyncFunction("cleanup") Coroutine { extractionId: String ->
      withContext(Dispatchers.IO) {
        cleanupJob(extractionId)
      }
    }
  }

  private fun extractArchive(sourceUri: String, extractionId: String): Map<String, Any> {
    val job = ownedJob(extractionId)
    if (job.exists() || !job.mkdirs()) {
      throw CodedException(
        "ERR_CBR_DESTINATION_EXISTS",
        "The native CBR import directory could not be created",
        null,
      )
    }

    try {
      recordMemoryCheckpoint("before-source-acquisition", extractionId)
      val localSource = acquireSource(sourceUri, File(job, "source.cbr"))
      recordMemoryCheckpoint(
        "source-acquired",
        extractionId,
        "sourceBytes=${localSource.length()}",
      )
      val destination = File(job, "extracted")
      recordMemoryCheckpoint("extraction-start", extractionId)
      val values = nativeCall {
        extractNative(localSource.absolutePath, destination.absolutePath)
      }
      recordMemoryCheckpoint(
        "extraction-complete",
        extractionId,
        "entryCount=${values[0]},fileCount=${values[1]},totalBytes=${values[2]}",
      )
      if (!localSource.delete()) {
        throw CodedException(
          "ERR_CBR_CLEANUP",
          "The temporary CBR source copy could not be removed",
          null,
        )
      }
      recordMemoryCheckpoint("source-copy-removed", extractionId)
      return mapOf(
        "directoryUri" to Uri.fromFile(destination).toString(),
        "entryCount" to values[0],
        "fileCount" to values[1],
        "totalBytes" to values[2],
        "solid" to (values[3] == 1L),
      )
    } catch (error: Throwable) {
      if (!job.deleteRecursively() && job.exists()) {
        throw CodedException(
          "ERR_CBR_CLEANUP",
          "The failed CBR import directory could not be removed",
          error,
        )
      }
      throw error
    }
  }

  private fun acquireSource(sourceUri: String, destination: File): File {
    if (sourceUri.isBlank()) {
      throw CodedException(
        "ERR_CBR_SOURCE_ACCESS",
        "A CBR source URI is required",
        null,
      )
    }
    val maximumBytes = maxArchiveBytesNative()
    try {
      openSourceStream(sourceUri).use { input ->
        FileOutputStream(destination).use { output ->
          val buffer = ByteArray(SOURCE_COPY_BUFFER_BYTES)
          var totalBytes = 0L
          while (true) {
            val read = input.read(buffer)
            if (read < 0) {
              break
            }
            if (read == 0) {
              continue
            }
            val readBytes = read.toLong()
            if (totalBytes > maximumBytes - readBytes) {
              throw CodedException(
                "ERR_CBR_ARCHIVE_SIZE_LIMIT",
                "The CBR archive exceeds the native input size limit",
                null,
              )
            }
            output.write(buffer, 0, read)
            totalBytes += readBytes
          }
        }
      }
    } catch (error: CodedException) {
      throw error
    } catch (error: Throwable) {
      throw CodedException(
        "ERR_CBR_SOURCE_ACCESS",
        "The selected CBR archive could not be copied locally",
        error,
      )
    }
    return destination
  }

  private fun openSourceStream(sourceUri: String): InputStream {
    val uri = Uri.parse(sourceUri)
    return when (uri.scheme?.lowercase()) {
      "content" -> context.contentResolver.openInputStream(uri)
        ?: throw CodedException(
          "ERR_CBR_SOURCE_ACCESS",
          "The selected CBR content URI could not be opened",
          null,
        )
      "file" -> FileInputStream(
        uri.path ?: throw CodedException(
          "ERR_CBR_SOURCE_ACCESS",
          "The selected CBR file URI has no path",
          null,
        ),
      )
      null -> FileInputStream(sourceUri)
      else -> throw CodedException(
        "ERR_CBR_SOURCE_ACCESS",
        "The selected CBR URI scheme is not supported",
        null,
      )
    }
  }

  private fun cleanupJob(extractionId: String) {
    val job = ownedJob(extractionId)
    if (!job.deleteRecursively() && job.exists()) {
      throw CodedException(
        "ERR_CBR_CLEANUP",
        "The temporary CBR import directory could not be removed",
        null,
      )
    }
  }

  private fun ownedJob(extractionId: String): File {
    if (!EXTRACTION_ID.matches(extractionId)) {
      throw CodedException(
        "ERR_CBR_UNSAFE_CLEANUP",
        "The CBR extraction identifier is invalid",
        null,
      )
    }
    val root = File(context.cacheDir, TEMPORARY_ROOT).canonicalFile
    val job = File(root, extractionId).canonicalFile
    if (!job.path.startsWith(root.path + File.separator)) {
      throw CodedException(
        "ERR_CBR_UNSAFE_CLEANUP",
        "The CBR import path is outside its native temporary root",
        null,
      )
    }
    return job
  }

  private fun recordMemoryCheckpoint(
    stage: String,
    extractionId: String,
    details: String = "",
  ) {
    val memory = Debug.MemoryInfo()
    Debug.getMemoryInfo(memory)
    Log.i(
      MEMORY_LOG_TAG,
      "stage=$stage,extractionId=$extractionId,totalPssKb=${memory.totalPss}," +
        "nativePrivateDirtyKb=${memory.nativePrivateDirty},$details",
    )
  }

  private external fun extractNative(sourcePath: String, destinationPath: String): LongArray
  private external fun maxArchiveBytesNative(): Long

  private fun <T> nativeCall(block: () -> T): T = try {
    block()
  } catch (error: IllegalStateException) {
    val (code, message) = error.message
      ?.split('|', limit = 2)
      ?.let { parts -> parts.first() to parts.getOrElse(1) { parts.first() } }
      ?: ("ERR_CBR_NATIVE" to "The native CBR extractor failed")
    throw CodedException(code, message, error)
  }

  private companion object {
    const val MEMORY_LOG_TAG = "ReebbonCbrMemory"
    const val SOURCE_COPY_BUFFER_BYTES = 64 * 1024
    const val TEMPORARY_ROOT = "reebbon-cbr"
    val EXTRACTION_ID = Regex("^[A-Za-z0-9][A-Za-z0-9._-]*$")
  }
}
