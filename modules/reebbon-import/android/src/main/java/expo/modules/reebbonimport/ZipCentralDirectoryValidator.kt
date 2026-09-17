package expo.modules.reebbonimport

import java.io.InputStream

private const val ZIP_END_RECORD_MAX_BYTES = 65_535 + 22

internal class ZipCentralDirectoryValidator {
  fun validate(source: InputStream, extractedEntries: Int): Boolean {
    val tail = ArchiveTailBuffer()
    val buffer = ByteArray(CBZ_BUFFER_BYTES)
    var archiveBytes = 0L
    while (true) {
      val read = source.read(buffer)
      if (read < 0) {
        break
      }
      if (read == 0) {
        continue
      }
      archiveBytes += read
      tail.append(buffer, read)
    }
    return hasValidEndRecord(tail.toByteArray(), archiveBytes, extractedEntries)
  }

  private fun hasValidEndRecord(
    bytes: ByteArray,
    archiveBytes: Long,
    extractedEntries: Int,
  ): Boolean {
    if (bytes.size < 22) {
      return false
    }
    for (offset in bytes.size - 22 downTo 0) {
      if (!hasEndRecordSignature(bytes, offset)) {
        continue
      }
      val commentLength = readUInt16(bytes, offset + 20)
      if (offset + 22 + commentLength != bytes.size) {
        continue
      }

      val disk = readUInt16(bytes, offset + 4)
      val centralDisk = readUInt16(bytes, offset + 6)
      val diskEntries = readUInt16(bytes, offset + 8)
      val totalEntries = readUInt16(bytes, offset + 10)
      val centralSize = readUInt32(bytes, offset + 12)
      val centralOffset = readUInt32(bytes, offset + 16)
      val endRecordOffset = archiveBytes - bytes.size + offset
      val usesZip64 =
        diskEntries == 0xffff ||
          totalEntries == 0xffff ||
          centralSize == 0xffffffffL ||
          centralOffset == 0xffffffffL

      return !usesZip64 &&
        disk == 0 &&
        centralDisk == 0 &&
        diskEntries == totalEntries &&
        totalEntries == extractedEntries &&
        centralOffset + centralSize <= endRecordOffset
    }
    return false
  }

  private fun hasEndRecordSignature(bytes: ByteArray, offset: Int): Boolean {
    return (bytes[offset].toInt() and 0xff) == 0x50 &&
      (bytes[offset + 1].toInt() and 0xff) == 0x4b &&
      (bytes[offset + 2].toInt() and 0xff) == 0x05 &&
      (bytes[offset + 3].toInt() and 0xff) == 0x06
  }

  private fun readUInt16(bytes: ByteArray, offset: Int): Int {
    return (bytes[offset].toInt() and 0xff) or
      ((bytes[offset + 1].toInt() and 0xff) shl 8)
  }

  private fun readUInt32(bytes: ByteArray, offset: Int): Long {
    return readUInt16(bytes, offset).toLong() or
      (readUInt16(bytes, offset + 2).toLong() shl 16)
  }
}

private class ArchiveTailBuffer {
  private val bytes = ByteArray(ZIP_END_RECORD_MAX_BYTES)
  private var length = 0
  private var writeOffset = 0

  fun append(source: ByteArray, byteCount: Int) {
    val retainedCount = minOf(byteCount, ZIP_END_RECORD_MAX_BYTES)
    val sourceOffset = byteCount - retainedCount
    val firstCount = minOf(retainedCount, ZIP_END_RECORD_MAX_BYTES - writeOffset)
    source.copyInto(bytes, writeOffset, sourceOffset, sourceOffset + firstCount)
    if (firstCount < retainedCount) {
      source.copyInto(
        bytes,
        0,
        sourceOffset + firstCount,
        sourceOffset + retainedCount,
      )
    }
    writeOffset = (writeOffset + retainedCount) % ZIP_END_RECORD_MAX_BYTES
    length = minOf(ZIP_END_RECORD_MAX_BYTES, length + retainedCount)
  }

  fun toByteArray(): ByteArray {
    if (length < ZIP_END_RECORD_MAX_BYTES) {
      return bytes.copyOf(length)
    }

    val ordered = ByteArray(ZIP_END_RECORD_MAX_BYTES)
    bytes.copyInto(ordered, 0, writeOffset)
    bytes.copyInto(ordered, ZIP_END_RECORD_MAX_BYTES - writeOffset, 0, writeOffset)
    return ordered
  }
}
