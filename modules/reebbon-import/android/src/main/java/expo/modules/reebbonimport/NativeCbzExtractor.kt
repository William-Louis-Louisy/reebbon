package expo.modules.reebbonimport

import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.util.zip.ZipInputStream

internal const val CBZ_BUFFER_BYTES = 64 * 1024
private const val MAX_ENTRIES = 10_000
private const val MAX_ENTRY_BYTES = 512L * 1024L * 1024L
private const val MAX_TOTAL_BYTES = 4L * 1024L * 1024L * 1024L
private const val MAX_PATH_LENGTH = 1_024

internal data class NativeCbzExtractionResult(
  val entryCount: Int,
  val fileCount: Long,
  val totalBytes: Long,
)

internal class NativeCbzCorruptedArchiveException(cause: Throwable? = null) :
  RuntimeException(cause)

internal class NativeCbzWriteFailureException(cause: Throwable? = null) :
  RuntimeException(cause)

internal class NativeCbzSourceReadFailureException(cause: Throwable? = null) :
  RuntimeException(cause)

internal class NativeCbzExtractor(
  private val checkpoint: (String, Map<String, Any?>) -> Unit,
) {
  fun extract(source: InputStream, destination: File): NativeCbzExtractionResult {
    ZipInputStream(BufferedInputStream(source, CBZ_BUFFER_BYTES)).use { archive ->
      return extractEntries(archive, destination)
    }
  }

  private fun extractEntries(
    archive: ZipInputStream,
    destination: File,
  ): NativeCbzExtractionResult {
    val seenPaths = mutableSetOf<String>()
    val buffer = ByteArray(CBZ_BUFFER_BYTES)
    var entryCount = 0
    var fileCount = 0L
    var totalBytes = 0L

    while (true) {
      val entry = archive.nextEntry ?: break
      entryCount += 1
      if (entryCount > MAX_ENTRIES) {
        throw NativeCbzCorruptedArchiveException()
      }

      val relativePath = normalizeArchivePath(entry.name, entry.isDirectory)
      if (!seenPaths.add(relativePath)) {
        throw NativeCbzCorruptedArchiveException()
      }
      val output = safeOutput(destination, relativePath)
      checkpoint(
        "cbz-entry-start",
        mapOf(
          "entryIndex" to entryCount,
          "declaredCompressedBytes" to entry.compressedSize,
          "declaredUncompressedBytes" to entry.size,
          "totalExtractedBytes" to totalBytes,
        ),
      )

      var entryBytes = 0L
      if (entry.isDirectory) {
        ensureDirectory(output)
      } else {
        validateDeclaredSize(entry.size, totalBytes)
        val parent = output.parentFile ?: throw NativeCbzCorruptedArchiveException()
        ensureDirectory(parent)
        if (output.exists()) {
          throw NativeCbzCorruptedArchiveException()
        }

        val writer = try {
          FileOutputStream(output)
        } catch (error: IOException) {
          throw NativeCbzWriteFailureException(error)
        } catch (error: SecurityException) {
          throw NativeCbzWriteFailureException(error)
        }
        try {
          writer.use {
            while (true) {
              val read = try {
                archive.read(buffer)
              } catch (error: java.util.zip.ZipException) {
                throw error
              } catch (error: IOException) {
                throw NativeCbzSourceReadFailureException(error)
              }
              if (read < 0) {
                break
              }
              if (read == 0) {
                continue
              }
              entryBytes += read
              totalBytes += read
              if (entryBytes > MAX_ENTRY_BYTES || totalBytes > MAX_TOTAL_BYTES) {
                throw NativeCbzCorruptedArchiveException()
              }
              try {
                writer.write(buffer, 0, read)
              } catch (error: IOException) {
                throw NativeCbzWriteFailureException(error)
              }
            }
          }
        } catch (error: NativeCbzCorruptedArchiveException) {
          throw error
        } catch (error: NativeCbzSourceReadFailureException) {
          throw error
        } catch (error: NativeCbzWriteFailureException) {
          throw error
        } catch (error: IOException) {
          throw NativeCbzWriteFailureException(error)
        }
        fileCount += 1
      }

      archive.closeEntry()
      checkpoint(
        "cbz-entry-complete",
        mapOf(
          "entryBytes" to entryBytes,
          "entryIndex" to entryCount,
          "totalExtractedBytes" to totalBytes,
        ),
      )
    }

    return NativeCbzExtractionResult(entryCount, fileCount, totalBytes)
  }

  private fun normalizeArchivePath(value: String, isDirectory: Boolean): String {
    if (
      value.isBlank() ||
      value.length > MAX_PATH_LENGTH ||
      value.indexOf('\\') >= 0 ||
      value.indexOf('\u0000') >= 0 ||
      value.startsWith('/') ||
      Regex("^[A-Za-z]:").containsMatchIn(value)
    ) {
      throw NativeCbzCorruptedArchiveException()
    }

    val normalized = if (isDirectory && value.endsWith('/')) value.dropLast(1) else value
    val segments = normalized.split('/')
    if (segments.any { it.isBlank() || it == "." || it == ".." }) {
      throw NativeCbzCorruptedArchiveException()
    }
    return normalized
  }

  private fun safeOutput(destination: File, relativePath: String): File {
    val output = try {
      File(destination, relativePath).canonicalFile
    } catch (error: IOException) {
      throw NativeCbzWriteFailureException(error)
    } catch (error: SecurityException) {
      throw NativeCbzWriteFailureException(error)
    }
    val rootPrefix = destination.path + File.separator
    if (!output.path.startsWith(rootPrefix)) {
      throw NativeCbzCorruptedArchiveException()
    }
    return output
  }

  private fun ensureDirectory(directory: File) {
    try {
      if (!directory.mkdirs() && !directory.isDirectory) {
        throw NativeCbzWriteFailureException()
      }
    } catch (error: SecurityException) {
      throw NativeCbzWriteFailureException(error)
    }
  }

  private fun validateDeclaredSize(declaredBytes: Long, totalBytes: Long) {
    if (
      declaredBytes > MAX_ENTRY_BYTES ||
      (declaredBytes >= 0 && declaredBytes > MAX_TOTAL_BYTES - totalBytes)
    ) {
      throw NativeCbzCorruptedArchiveException()
    }
  }
}
