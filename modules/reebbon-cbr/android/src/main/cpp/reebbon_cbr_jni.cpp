#include <jni.h>

#include <string>

#include "reebbon_cbr.hpp"

namespace {

class UtfChars final {
 public:
  UtfChars(JNIEnv* environment, jstring value)
      : environment_(environment), value_(value),
        chars_(environment->GetStringUTFChars(value, nullptr)) {}

  ~UtfChars() {
    if (chars_ != nullptr) {
      environment_->ReleaseStringUTFChars(value_, chars_);
    }
  }

  const char* get() const { return chars_; }

 private:
  JNIEnv* environment_;
  jstring value_;
  const char* chars_;
};

void throwNativeError(JNIEnv* environment, const std::string& code,
                      const std::string& message) {
  const jclass exceptionClass = environment->FindClass("java/lang/IllegalStateException");
  if (exceptionClass != nullptr) {
    environment->ThrowNew(exceptionClass, (code + "|" + message).c_str());
  }
}

}  // namespace

extern "C" JNIEXPORT jlongArray JNICALL
Java_expo_modules_reebboncbr_ReebbonCbrModule_extractNative(
    JNIEnv* environment, jobject, jstring sourcePath, jstring destinationPath) {
  if (sourcePath == nullptr || destinationPath == nullptr) {
    throwNativeError(environment, "ERR_CBR_INVALID_ARGUMENT", "Paths are required");
    return nullptr;
  }

  UtfChars source(environment, sourcePath);
  UtfChars destination(environment, destinationPath);
  if (source.get() == nullptr || destination.get() == nullptr) {
    return nullptr;
  }

  try {
    const auto result = reebbon::cbr::extractToDirectory(source.get(), destination.get());
    const jlong values[] = {
        static_cast<jlong>(result.entryCount),
        static_cast<jlong>(result.fileCount),
        static_cast<jlong>(result.totalBytes),
        result.solid ? 1L : 0L,
    };
    jlongArray output = environment->NewLongArray(4);
    if (output != nullptr) {
      environment->SetLongArrayRegion(output, 0, 4, values);
    }
    return output;
  } catch (const reebbon::cbr::ExtractionError& error) {
    throwNativeError(environment, error.code(), error.what());
  } catch (const std::exception& error) {
    throwNativeError(environment, "ERR_CBR_NATIVE", error.what());
  }
  return nullptr;
}

extern "C" JNIEXPORT jlong JNICALL
Java_expo_modules_reebboncbr_ReebbonCbrModule_maxArchiveBytesNative(
    JNIEnv*, jobject) {
  return static_cast<jlong>(reebbon::cbr::Limits{}.maxArchiveBytes);
}
