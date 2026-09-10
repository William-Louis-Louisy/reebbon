package expo.modules.reebbonimport

import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Debug
import android.os.SystemClock
import android.util.Log
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.EOFException
import java.io.File
import java.io.FileInputStream
import java.io.FileNotFoundException
import java.io.IOException
import java.io.InputStream
import java.util.zip.ZipException

private const val LOG_TAG = "ReebbonImportMemory"

class ReebbonImportModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ReebbonImport")

    AsyncFunction("recordMemoryCheckpoint") Coroutine { stage: String, details: Map<String, Any?> ->
      withContext(Dispatchers.IO) {
        recordMemoryCheckpoint(stage, details)
      }
    }

    AsyncFunction("extractCbz") Coroutine { sourceUri: String, destinationUri: String ->
      withContext(Dispatchers.IO) {
        extractCbz(sourceUri, destinationUri)
      }
    }
  }

  private fun extractCbz(sourceUri: String, destinationUri: String): Map<String, Long> {
    val destination = destinationDirectory(destinationUri)
    recordMemoryCheckpoint("cbz-extraction-start", emptyMap())

    try {
      val result = openSource(sourceUri).use { input ->
        NativeCbzExtractor(::recordMemoryCheckpoint).extract(input, destination)
      }
      recordMemoryCheckpoint(
        "cbz-central-directory-validation-start",
        mapOf("entryCount" to result.entryCount),
      )
      val centralDirectoryValid = openSource(sourceUri).use { validationSource ->
        ZipCentralDirectoryValidator().validate(validationSource, result.entryCount)
      }
      if (!centralDirectoryValid) {
        throw NativeCbzCorruptedArchiveException()
      }
      recordMemoryCheckpoint(
        "cbz-central-directory-validation-complete",
        mapOf("entryCount" to result.entryCount),
      )
      val response = mapOf(
        "fileCount" to result.fileCount,
        "totalBytes" to result.totalBytes,
      )
      recordMemoryCheckpoint("cbz-extraction-complete", response)
      return response
    } catch (error: CbzPermissionOrAccessFailureException) {
      recordFailure("permission")
      throw error
    } catch (error: NativeCbzCorruptedArchiveException) {
      recordFailure("corrupted-archive")
      throw CbzCorruptedArchiveException(error)
    } catch (error: NativeCbzWriteFailureException) {
      recordFailure("filesystem")
      throw CbzFilesystemFailureException(error)
    } catch (error: NativeCbzSourceReadFailureException) {
      recordFailure("source-read")
      throw CbzPermissionOrAccessFailureException(error)
    } catch (error: ZipException) {
      recordFailure("corrupted-archive")
      throw CbzCorruptedArchiveException(error)
    } catch (error: EOFException) {
      recordFailure("corrupted-archive")
      throw CbzCorruptedArchiveException(error)
    } catch (error: IllegalArgumentException) {
      recordFailure("corrupted-archive")
      throw CbzCorruptedArchiveException(error)
    } catch (error: SecurityException) {
      recordFailure("permission")
      throw CbzPermissionOrAccessFailureException(error)
    } catch (error: IOException) {
      recordFailure("source-read")
      throw CbzPermissionOrAccessFailureException(error)
    }
  }

  private fun openSource(value: String): InputStream {
    val uri = try {
      Uri.parse(value)
    } catch (error: Exception) {
      throw CbzPermissionOrAccessFailureException(error)
    }

    return try {
      when (uri.scheme?.lowercase()) {
        "content", "android.resource" ->
          context.contentResolver.openInputStream(uri)
            ?: throw FileNotFoundException("The selected document is unavailable")
        "file", null -> FileInputStream(File(requireNotNull(uri.path)))
        else -> throw FileNotFoundException("Unsupported document URI")
      }
    } catch (error: SecurityException) {
      throw CbzPermissionOrAccessFailureException(error)
    } catch (error: FileNotFoundException) {
      throw CbzPermissionOrAccessFailureException(error)
    }
  }

  private fun destinationDirectory(value: String): File {
    return try {
      val uri = Uri.parse(value)
      if (uri.scheme?.lowercase() != "file" || uri.path.isNullOrBlank()) {
        throw CbzFilesystemFailureException()
      }
      File(requireNotNull(uri.path)).canonicalFile.also {
        if (!it.isDirectory) {
          throw CbzFilesystemFailureException()
        }
      }
    } catch (error: CodedException) {
      throw error
    } catch (error: Exception) {
      throw CbzFilesystemFailureException(error)
    }
  }

  private fun recordFailure(code: String) {
    recordMemoryCheckpoint("cbz-extraction-failed", mapOf("code" to code))
  }

  private fun recordMemoryCheckpoint(stage: String, details: Map<String, Any?>) {
    try {
      val memory = Debug.MemoryInfo()
      Debug.getMemoryInfo(memory)
      val runtime = Runtime.getRuntime()
      val status = readProcessStatus()
      val snapshot = linkedMapOf<String, Any?>(
        "stage" to stage,
        "elapsedRealtimeMs" to SystemClock.elapsedRealtime(),
        "rssKb" to status["VmRSS"],
        "swapKb" to status["VmSwap"],
        "totalPssKb" to memory.totalPss,
        "privateDirtyKb" to memory.totalPrivateDirty,
        "nativeHeapAllocatedKb" to Debug.getNativeHeapAllocatedSize() / 1024L,
        "javaHeapUsedKb" to (runtime.totalMemory() - runtime.freeMemory()) / 1024L,
      )
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        snapshot["javaPssKb"] = memory.getMemoryStat("summary.java-heap")
        snapshot["nativePssKb"] = memory.getMemoryStat("summary.native-heap")
        snapshot["graphicsPssKb"] = memory.getMemoryStat("summary.graphics")
        snapshot["codePssKb"] = memory.getMemoryStat("summary.code")
        snapshot["stackPssKb"] = memory.getMemoryStat("summary.stack")
        snapshot["privateOtherPssKb"] = memory.getMemoryStat("summary.private-other")
        snapshot["systemPssKb"] = memory.getMemoryStat("summary.system")
      }
      snapshot["details"] = details
      Log.i(LOG_TAG, JSONObject(snapshot).toString())
    } catch (error: Exception) {
      Log.w(LOG_TAG, "Unable to record import memory checkpoint $stage", error)
    }
  }

  private fun readProcessStatus(): Map<String, Long> {
    return try {
      File("/proc/self/status").useLines { lines ->
        lines.mapNotNull { line ->
          val key = line.substringBefore(':')
          if (key != "VmRSS" && key != "VmSwap") {
            return@mapNotNull null
          }
          val value = line.substringAfter(':').trim().substringBefore(' ').toLongOrNull()
          value?.let { key to it }
        }.toMap()
      }
    } catch (_: IOException) {
      emptyMap()
    }
  }
}

private class CbzCorruptedArchiveException(cause: Throwable? = null) :
  CodedException("ERR_CBZ_CORRUPTED_ARCHIVE", "The CBZ archive is corrupted", cause)

private class CbzPermissionOrAccessFailureException(cause: Throwable? = null) :
  CodedException("ERR_CBZ_PERMISSION_OR_ACCESS_FAILURE", "The CBZ source is unavailable", cause)

private class CbzFilesystemFailureException(cause: Throwable? = null) :
  CodedException("ERR_CBZ_FILESYSTEM_FAILURE", "The CBZ extraction could not be written", cause)
