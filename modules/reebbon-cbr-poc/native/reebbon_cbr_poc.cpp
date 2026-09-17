#include "reebbon_cbr_poc.hpp"

#if !defined(_WIN32) && !defined(_UNIX)
#define _UNIX
#endif
#include "unrar/dll.hpp"

#include <algorithm>
#include <cwctype>
#include <filesystem>
#include <limits>
#include <memory>
#include <set>
#include <system_error>
#include <utility>
#include <vector>

namespace reebbon::cbr {
namespace {

namespace fs = std::filesystem;

struct CallbackContext {
  const Limits* limits = nullptr;
  std::uint64_t currentEntryBytes = 0;
  std::uint64_t completedBytes = 0;
  bool passwordRequested = false;
  bool dictionaryRejected = false;
  bool volumeRequested = false;
  bool sizeLimitExceeded = false;
};

int CALLBACK extractionCallback(UINT message, LPARAM userData, LPARAM, LPARAM value) {
  auto* context = reinterpret_cast<CallbackContext*>(userData);
  if (context == nullptr || context->limits == nullptr) {
    return -1;
  }

  switch (message) {
    case UCM_PROCESSDATA: {
      if (value < 0) {
        context->sizeLimitExceeded = true;
        return -1;
      }
      const auto bytes = static_cast<std::uint64_t>(value);
      if (context->currentEntryBytes > context->limits->maxEntryBytes ||
          bytes > context->limits->maxEntryBytes - context->currentEntryBytes ||
          context->completedBytes > context->limits->maxTotalBytes ||
          context->currentEntryBytes >
              context->limits->maxTotalBytes - context->completedBytes ||
          bytes > context->limits->maxTotalBytes - context->completedBytes -
                      context->currentEntryBytes) {
        context->sizeLimitExceeded = true;
        return -1;
      }
      context->currentEntryBytes += bytes;
      return 1;
    }
    case UCM_NEEDPASSWORD:
    case UCM_NEEDPASSWORDW:
      context->passwordRequested = true;
      return -1;
    case UCM_LARGEDICT:
      context->dictionaryRejected = true;
      return -1;
    case UCM_CHANGEVOLUME:
    case UCM_CHANGEVOLUMEW:
      context->volumeRequested = true;
      return -1;
    default:
      return 1;
  }
}

class ArchiveHandle final {
 public:
  explicit ArchiveHandle(HANDLE value) : value_(value) {}
  ~ArchiveHandle() {
    if (value_ != nullptr) {
      RARCloseArchive(value_);
    }
  }

  ArchiveHandle(const ArchiveHandle&) = delete;
  ArchiveHandle& operator=(const ArchiveHandle&) = delete;

  HANDLE get() const { return value_; }

 private:
  HANDLE value_;
};

[[noreturn]] void throwForUnrarError(int result, const CallbackContext& context) {
  if (context.passwordRequested || result == ERAR_MISSING_PASSWORD ||
      result == ERAR_BAD_PASSWORD) {
    throw ExtractionError("ERR_CBR_ENCRYPTED_ARCHIVE",
                          "Encrypted RAR archives are not accepted by the POC");
  }
  if (context.dictionaryRejected || result == ERAR_LARGE_DICT) {
    throw ExtractionError("ERR_CBR_DICTIONARY_LIMIT",
                          "The RAR dictionary exceeds the native memory limit");
  }
  if (context.sizeLimitExceeded) {
    throw ExtractionError("ERR_CBR_SIZE_LIMIT",
                          "The extracted data exceeds a configured size limit");
  }
  if (context.volumeRequested) {
    throw ExtractionError("ERR_CBR_MULTIVOLUME_UNSUPPORTED",
                          "Multi-volume RAR archives are not supported by the POC");
  }

  switch (result) {
    case ERAR_BAD_DATA:
    case ERAR_BAD_ARCHIVE:
    case ERAR_UNKNOWN_FORMAT:
      throw ExtractionError("ERR_CBR_CORRUPTED_ARCHIVE",
                            "The RAR archive is invalid or corrupted");
    case ERAR_EOPEN:
    case ERAR_EREAD:
      throw ExtractionError("ERR_CBR_SOURCE_ACCESS",
                            "The RAR archive could not be read");
    case ERAR_ECREATE:
    case ERAR_ECLOSE:
    case ERAR_EWRITE:
      throw ExtractionError("ERR_CBR_FILESYSTEM",
                            "The extracted entry could not be written");
    case ERAR_NO_MEMORY:
      throw ExtractionError("ERR_CBR_NATIVE_MEMORY",
                            "UnRAR could not allocate native memory");
    default:
      throw ExtractionError("ERR_CBR_EXTRACTION",
                            "UnRAR failed with error " + std::to_string(result));
  }
}

std::wstring normalizedArchivePath(std::wstring_view rawPath) {
  std::wstring normalized(rawPath);
  std::replace(normalized.begin(), normalized.end(), L'\\', L'/');
  while (!normalized.empty() && normalized.back() == L'/') {
    normalized.pop_back();
  }
  return normalized;
}

std::wstring collisionKey(std::wstring_view path) {
  std::wstring key(path);
  std::transform(key.begin(), key.end(), key.begin(), [](wchar_t character) {
    return std::towlower(character);
  });
  return key;
}

std::uint64_t uint64FromParts(unsigned int low, unsigned int high) {
  return static_cast<std::uint64_t>(low) |
         (static_cast<std::uint64_t>(high) << 32U);
}

std::wstring pathToWide(const fs::path& path) {
  try {
    return path.wstring();
  } catch (const std::exception& error) {
    throw ExtractionError("ERR_CBR_PATH_ENCODING",
                          std::string("A filesystem path cannot be encoded: ") +
                              error.what());
  }
}

}  // namespace

ExtractionError::ExtractionError(std::string code, std::string message)
    : std::runtime_error(std::move(message)), code_(std::move(code)) {}

const std::string& ExtractionError::code() const noexcept { return code_; }

bool isSafeRelativeArchivePath(std::wstring_view archivePath,
                               std::size_t maxCharacters) {
  if (archivePath.empty() || archivePath.size() > maxCharacters) {
    return false;
  }

  const std::wstring normalized = normalizedArchivePath(archivePath);
  if (normalized.empty() || normalized.front() == L'/' ||
      normalized.find(L'\0') != std::wstring::npos ||
      normalized.find(L':') != std::wstring::npos) {
    return false;
  }

  std::size_t componentStart = 0;
  while (componentStart <= normalized.size()) {
    const std::size_t separator = normalized.find(L'/', componentStart);
    const std::size_t componentEnd =
        separator == std::wstring::npos ? normalized.size() : separator;
    const std::wstring_view component =
        std::wstring_view(normalized).substr(componentStart,
                                             componentEnd - componentStart);
    if (component.empty() || component == L"." || component == L"..") {
      return false;
    }
    if (std::any_of(component.begin(), component.end(), [](wchar_t character) {
          return character < 0x20;
        })) {
      return false;
    }
    if (separator == std::wstring::npos) {
      break;
    }
    componentStart = separator + 1;
  }
  return true;
}

void validateEntryLimits(std::uint64_t entryBytes,
                         std::uint64_t accumulatedBytes,
                         std::uint64_t dictionaryBytes,
                         std::uint32_t nextEntryCount,
                         const Limits& limits) {
  if (nextEntryCount > limits.maxEntries) {
    throw ExtractionError("ERR_CBR_ENTRY_COUNT_LIMIT",
                          "The RAR archive contains too many entries");
  }
  if (dictionaryBytes > limits.maxDictionaryBytes) {
    throw ExtractionError("ERR_CBR_DICTIONARY_LIMIT",
                          "The RAR dictionary exceeds the native memory limit");
  }
  if (entryBytes > limits.maxEntryBytes) {
    throw ExtractionError("ERR_CBR_ENTRY_SIZE_LIMIT",
                          "A RAR entry exceeds the configured size limit");
  }
  if (accumulatedBytes > limits.maxTotalBytes ||
      entryBytes > limits.maxTotalBytes - accumulatedBytes) {
    throw ExtractionError("ERR_CBR_TOTAL_SIZE_LIMIT",
                          "The RAR archive exceeds the total size limit");
  }
}

ExtractionResult extractToDirectory(const std::string& sourcePath,
                                    const std::string& destinationPath,
                                    const Limits& limits) {
  if (sourcePath.empty() || destinationPath.empty()) {
    throw ExtractionError("ERR_CBR_INVALID_ARGUMENT",
                          "Source and destination paths are required");
  }

  const fs::path source = fs::u8path(sourcePath);
  const fs::path destination = fs::u8path(destinationPath);
  std::error_code filesystemError;
  if (!fs::is_regular_file(source, filesystemError) || filesystemError) {
    throw ExtractionError("ERR_CBR_SOURCE_ACCESS",
                          "The RAR source is not a readable regular file");
  }
  if (fs::exists(destination, filesystemError) || filesystemError) {
    throw ExtractionError("ERR_CBR_DESTINATION_EXISTS",
                          "The extraction destination must not already exist");
  }
  if (!fs::create_directories(destination, filesystemError) || filesystemError) {
    throw ExtractionError("ERR_CBR_FILESYSTEM",
                          "The extraction destination could not be created");
  }

  try {
    std::wstring sourceWide = pathToWide(source);
    std::wstring destinationWide = pathToWide(destination);
    CallbackContext callbackContext{};
    callbackContext.limits = &limits;
    RAROpenArchiveDataEx openData{};
    openData.ArcNameW = sourceWide.data();
    openData.OpenMode = RAR_OM_EXTRACT;
    openData.Callback = extractionCallback;
    openData.UserData = reinterpret_cast<LPARAM>(&callbackContext);

    ArchiveHandle archive(RAROpenArchiveEx(&openData));
    if (archive.get() == nullptr || openData.OpenResult != ERAR_SUCCESS) {
      throwForUnrarError(static_cast<int>(openData.OpenResult), callbackContext);
    }
    if ((openData.Flags & ROADF_ENCHEADERS) != 0U) {
      throw ExtractionError("ERR_CBR_ENCRYPTED_ARCHIVE",
                            "Header-encrypted RAR archives are not accepted");
    }

    ExtractionResult extractionResult{};
    extractionResult.solid = (openData.Flags & ROADF_SOLID) != 0U;
    std::uint64_t declaredTotalBytes = 0;
    std::set<std::wstring> seenPaths;
    std::vector<wchar_t> extendedName(limits.maxPathCharacters + 2U, L'\0');

    while (true) {
      RARHeaderDataEx header{};
      header.FileNameEx = extendedName.data();
      header.FileNameExSize = static_cast<unsigned int>(extendedName.size());
      const int headerResult = RARReadHeaderEx(archive.get(), &header);
      if (headerResult == ERAR_END_ARCHIVE) {
        break;
      }
      if (headerResult != ERAR_SUCCESS) {
        throwForUnrarError(headerResult, callbackContext);
      }

      const std::wstring_view rawName(header.FileNameEx != nullptr
                                          ? header.FileNameEx
                                          : header.FileNameW);
      if (!isSafeRelativeArchivePath(rawName, limits.maxPathCharacters)) {
        throw ExtractionError("ERR_CBR_UNSAFE_PATH",
                              "The RAR archive contains an unsafe entry path");
      }
      if (header.RedirType != 0U) {
        throw ExtractionError("ERR_CBR_LINK_UNSUPPORTED",
                              "RAR link and redirection entries are rejected");
      }

      std::wstring normalizedName = normalizedArchivePath(rawName);
      if (!seenPaths.emplace(collisionKey(normalizedName)).second) {
        throw ExtractionError("ERR_CBR_DUPLICATE_PATH",
                              "The RAR archive contains colliding entry paths");
      }

      const std::uint64_t entryBytes =
          uint64FromParts(header.UnpSize, header.UnpSizeHigh);
      const std::uint64_t dictionaryBytes =
          static_cast<std::uint64_t>(header.DictSize) * 1024ULL;
      validateEntryLimits(entryBytes, declaredTotalBytes, dictionaryBytes,
                          extractionResult.entryCount + 1U, limits);

      if ((header.Flags & RHDF_ENCRYPTED) != 0U) {
        throw ExtractionError("ERR_CBR_ENCRYPTED_ARCHIVE",
                              "Encrypted RAR entries are not accepted by the POC");
      }
      if ((header.Flags & (RHDF_SPLITBEFORE | RHDF_SPLITAFTER)) != 0U) {
        throw ExtractionError("ERR_CBR_MULTIVOLUME_UNSUPPORTED",
                              "Split RAR entries are not supported by the POC");
      }

      callbackContext.currentEntryBytes = 0;
      callbackContext.completedBytes = extractionResult.totalBytes;
      const int processResult = RARProcessFileW(
          archive.get(), RAR_EXTRACT, destinationWide.data(), normalizedName.data());
      if (processResult != ERAR_SUCCESS) {
        throwForUnrarError(processResult, callbackContext);
      }
      if (callbackContext.currentEntryBytes > entryBytes) {
        throw ExtractionError("ERR_CBR_DECLARED_SIZE_MISMATCH",
                              "A RAR entry expanded beyond its declared size");
      }

      extractionResult.entryCount += 1U;
      if ((header.Flags & RHDF_DIRECTORY) == 0U) {
        extractionResult.fileCount += 1U;
        declaredTotalBytes += entryBytes;
        extractionResult.totalBytes += callbackContext.currentEntryBytes;
      }
    }

    return extractionResult;
  } catch (...) {
    fs::remove_all(destination, filesystemError);
    throw;
  }
}

void cleanupDirectory(const std::string& destinationPath) {
  if (destinationPath.empty()) {
    throw ExtractionError("ERR_CBR_INVALID_ARGUMENT",
                          "A destination path is required for cleanup");
  }
  std::error_code error;
  fs::remove_all(fs::u8path(destinationPath), error);
  if (error) {
    throw ExtractionError("ERR_CBR_CLEANUP",
                          "The temporary extraction directory could not be removed");
  }
}

}  // namespace reebbon::cbr
