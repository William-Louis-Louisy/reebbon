package expo.modules.reebbonimport

import org.junit.Assert.assertEquals
import org.junit.Test

class LibraryCoverThumbnailerTest {
  @Test
  fun `sample size bounds a high resolution portrait cover`() {
    assertEquals(8, calculateCoverInSampleSize(8000, 12000, 720, 1056))
  }

  @Test
  fun `sample size does not upscale a small cover`() {
    assertEquals(1, calculateCoverInSampleSize(480, 640, 720, 1056))
  }

  @Test
  fun `sample size also bounds an extreme landscape cover`() {
    assertEquals(16, calculateCoverInSampleSize(12000, 1000, 720, 1056))
  }
}
