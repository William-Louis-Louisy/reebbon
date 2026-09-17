package expo.modules.reebbonimport

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.file.Files
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class NativeCbzExtractorTest {
  @Test
  fun extractsLargeImageSetsOneEntryAtATime() {
    val page = ByteArray(64 * 1024) { index -> (index % 251).toByte() }
    val archive = createArchive(
      (1..205).associate { index ->
        "page-${index.toString().padStart(4, '0')}.jpg" to page
      },
    )
    val destination = Files.createTempDirectory("reebbon-cbz-test").toFile()
    val checkpoints = mutableListOf<String>()

    try {
      val result = NativeCbzExtractor { stage, _ -> checkpoints.add(stage) }
        .extract(ByteArrayInputStream(archive), destination)

      assertEquals(205, result.entryCount)
      assertEquals(205L, result.fileCount)
      assertEquals(205L * page.size, result.totalBytes)
      assertEquals(205, checkpoints.count { it == "cbz-entry-start" })
      assertEquals(205, checkpoints.count { it == "cbz-entry-complete" })
      assertTrue(File(destination, "page-0205.jpg").isFile)
    } finally {
      destination.deleteRecursively()
    }
  }

  @Test
  fun validatesTheCompleteCentralDirectoryWithBoundedTailStorage() {
    val archive = createArchive(mapOf("page.jpg" to ByteArray(1024)))
    val validator = ZipCentralDirectoryValidator()

    assertTrue(validator.validate(ByteArrayInputStream(archive), 1))
    assertEquals(
      false,
      validator.validate(ByteArrayInputStream(archive.copyOf(archive.size - 10)), 1),
    )
  }

  @Test(expected = NativeCbzCorruptedArchiveException::class)
  fun rejectsDirectoryTraversalBeforeWriting() {
    val archive = createArchive(mapOf("../outside.jpg" to byteArrayOf(1, 2, 3)))
    val destination = Files.createTempDirectory("reebbon-cbz-test").toFile()

    try {
      NativeCbzExtractor { _, _ -> }.extract(ByteArrayInputStream(archive), destination)
    } finally {
      destination.deleteRecursively()
    }
  }

  private fun createArchive(entries: Map<String, ByteArray>): ByteArray {
    val output = ByteArrayOutputStream()
    ZipOutputStream(output).use { archive ->
      entries.forEach { (name, bytes) ->
        archive.putNextEntry(ZipEntry(name))
        archive.write(bytes)
        archive.closeEntry()
      }
    }
    return output.toByteArray()
  }
}
