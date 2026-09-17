package expo.modules.reebbonimport

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

internal data class LibraryCoverThumbnailResult(
  val width: Int,
  val height: Int,
  val sourceWidth: Int,
  val sourceHeight: Int,
  val generated: Boolean,
)

internal class LibraryCoverThumbnailer(
  private val openSource: () -> InputStream,
  private val destination: File,
  private val checkpoint: (String, Map<String, Any?>) -> Unit,
) {
  fun prepare(maxWidth: Int, maxHeight: Int): LibraryCoverThumbnailResult {
    require(maxWidth > 0 && maxHeight > 0)

    val source = inspectSource()
    val sampleSize = calculateCoverInSampleSize(
      source.first,
      source.second,
      maxWidth,
      maxHeight,
    )
    checkpoint(
      "library-cover-source-inspected",
      mapOf(
        "sourceWidth" to source.first,
        "sourceHeight" to source.second,
        "estimatedArgbKb" to estimatedArgbKb(source.first, source.second),
        "sampleSize" to sampleSize,
      ),
    )

    inspect(destination)?.let { cached ->
      checkpoint(
        "library-cover-thumbnail-reused",
        mapOf("thumbnailWidth" to cached.first, "thumbnailHeight" to cached.second),
      )
      return LibraryCoverThumbnailResult(
        width = cached.first,
        height = cached.second,
        sourceWidth = source.first,
        sourceHeight = source.second,
        generated = false,
      )
    }

    var decoded: Bitmap? = null
    var thumbnail: Bitmap? = null
    val temporary = File(destination.parentFile, "${destination.name}.tmp")
    try {
      decoded = openSource().use { input ->
        BitmapFactory.decodeStream(
          input,
          null,
          BitmapFactory.Options().apply {
            inSampleSize = sampleSize
            inPreferredConfig = Bitmap.Config.ARGB_8888
          },
        ) ?: throw IllegalArgumentException("Cover bitmap cannot be decoded")
      }

      val target = targetSize(decoded.width, decoded.height, maxWidth, maxHeight)
      thumbnail = Bitmap.createBitmap(target.first, target.second, Bitmap.Config.RGB_565)
      Canvas(thumbnail).apply {
        drawColor(Color.WHITE)
        drawBitmap(
          decoded,
          null,
          android.graphics.Rect(0, 0, target.first, target.second),
          null,
        )
      }

      destination.parentFile?.mkdirs()
      FileOutputStream(temporary).use { output ->
        if (!thumbnail.compress(Bitmap.CompressFormat.JPEG, 82, output)) {
          throw IllegalStateException("Cover thumbnail cannot be encoded")
        }
        output.fd.sync()
      }
      if (destination.exists() && !destination.delete()) {
        throw IllegalStateException("Stale cover thumbnail cannot be replaced")
      }
      if (!temporary.renameTo(destination)) {
        throw IllegalStateException("Cover thumbnail cannot be committed")
      }

      checkpoint(
        "library-cover-thumbnail-created",
        mapOf(
          "thumbnailWidth" to target.first,
          "thumbnailHeight" to target.second,
          "thumbnailBytes" to destination.length(),
        ),
      )
      return LibraryCoverThumbnailResult(
        width = target.first,
        height = target.second,
        sourceWidth = source.first,
        sourceHeight = source.second,
        generated = true,
      )
    } finally {
      temporary.delete()
      thumbnail?.recycle()
      decoded?.recycle()
    }
  }

  private fun inspectSource(): Pair<Int, Int> = openSource().use { input ->
    val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeStream(input, null, options)
    if (options.outWidth <= 0 || options.outHeight <= 0) {
      throw IllegalArgumentException("Cover dimensions are invalid")
    }
    options.outWidth to options.outHeight
  }

  private fun inspect(file: File): Pair<Int, Int>? {
    if (!file.isFile || file.length() <= 0) {
      return null
    }
    val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.absolutePath, options)
    return if (options.outWidth > 0 && options.outHeight > 0) {
      options.outWidth to options.outHeight
    } else {
      null
    }
  }
}

internal fun calculateCoverInSampleSize(
  sourceWidth: Int,
  sourceHeight: Int,
  maxWidth: Int,
  maxHeight: Int,
): Int {
  require(sourceWidth > 0 && sourceHeight > 0 && maxWidth > 0 && maxHeight > 0)
  val requiredScale = min(
    1.0,
    min(maxWidth.toDouble() / sourceWidth, maxHeight.toDouble() / sourceHeight),
  )
  var sampleSize = 1
  while (sampleSize <= Int.MAX_VALUE / 2 && 1.0 / (sampleSize * 2) >= requiredScale) {
    sampleSize *= 2
  }
  return sampleSize
}

private fun targetSize(
  sourceWidth: Int,
  sourceHeight: Int,
  maxWidth: Int,
  maxHeight: Int,
): Pair<Int, Int> {
  val scale = min(
    1.0,
    min(maxWidth.toDouble() / sourceWidth, maxHeight.toDouble() / sourceHeight),
  )
  return max(1, (sourceWidth * scale).roundToInt()) to
    max(1, (sourceHeight * scale).roundToInt())
}

private fun estimatedArgbKb(width: Int, height: Int): Long =
  width.toLong() * height.toLong() * 4L / 1024L
