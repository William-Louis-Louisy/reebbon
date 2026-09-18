#pragma once

#include <cstddef>
#include <cstdint>
#include <stdexcept>
#include <string>
#include <string_view>

namespace reebbon::cbr {

// UnRAR source code may be used in any software to handle RAR archives without
// limitations free of charge, but cannot be used to develop RAR (WinRAR)
// compatible archiver and to re-create RAR compression algorithm, which is
// proprietary. Distribution of modified UnRAR source code in separate form or
// as a part of other software is permitted, provided that full text of this
// paragraph, starting from "UnRAR source code" words, is included in license,
// or in documentation if license is not available, and in source code comments
// of resulting package. See ../NOTICE.md and unrar/license.txt for all terms.

struct Limits {
  std::uint64_t maxDictionaryBytes = 64ULL * 1024ULL * 1024ULL;
  std::uint64_t maxEntryBytes = 512ULL * 1024ULL * 1024ULL;
  std::uint64_t maxTotalBytes = 4ULL * 1024ULL * 1024ULL * 1024ULL;
  std::uint32_t maxEntries = 10'000;
  std::size_t maxPathCharacters = 1'024;
};

struct ExtractionResult {
  std::uint32_t entryCount = 0;
  std::uint32_t fileCount = 0;
  std::uint64_t totalBytes = 0;
  bool solid = false;
};

class ExtractionError final : public std::runtime_error {
 public:
  ExtractionError(std::string code, std::string message);

  const std::string& code() const noexcept;

 private:
  std::string code_;
};

bool isSafeRelativeArchivePath(std::wstring_view archivePath,
                               std::size_t maxCharacters);

void validateEntryLimits(std::uint64_t entryBytes,
                         std::uint64_t accumulatedBytes,
                         std::uint64_t dictionaryBytes,
                         std::uint32_t nextEntryCount,
                         const Limits& limits);

ExtractionResult extractToDirectory(const std::string& sourcePath,
                                    const std::string& destinationPath,
                                    const Limits& limits = {});

void cleanupDirectory(const std::string& destinationPath);

}  // namespace reebbon::cbr
