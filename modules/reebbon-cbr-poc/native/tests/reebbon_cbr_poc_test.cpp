#include "reebbon_cbr_poc.hpp"

#include <cassert>
#include <functional>
#include <string>

namespace {

void expectError(const std::string& expectedCode,
                 const std::function<void()>& operation) {
  try {
    operation();
    assert(false && "Expected an ExtractionError");
  } catch (const reebbon::cbr::ExtractionError& error) {
    assert(error.code() == expectedCode);
  }
}

}  // namespace

int main() {
  using reebbon::cbr::Limits;
  using reebbon::cbr::isSafeRelativeArchivePath;
  using reebbon::cbr::validateEntryLimits;

  assert(isSafeRelativeArchivePath(L"chapter/001.jpg", 1'024));
  assert(isSafeRelativeArchivePath(L"chapter\\002.png", 1'024));
  assert(!isSafeRelativeArchivePath(L"../escape.jpg", 1'024));
  assert(!isSafeRelativeArchivePath(L"chapter/../../escape.jpg", 1'024));
  assert(!isSafeRelativeArchivePath(L"/absolute.jpg", 1'024));
  assert(!isSafeRelativeArchivePath(L"C:\\absolute.jpg", 1'024));
  assert(!isSafeRelativeArchivePath(L"chapter//empty.jpg", 1'024));

  const Limits limits{};
  validateEntryLimits(1, 0, limits.maxDictionaryBytes, 1, limits);
  expectError("ERR_CBR_DICTIONARY_LIMIT", [&] {
    validateEntryLimits(1, 0, limits.maxDictionaryBytes + 1, 1, limits);
  });
  expectError("ERR_CBR_ENTRY_SIZE_LIMIT", [&] {
    validateEntryLimits(limits.maxEntryBytes + 1, 0, 1, 1, limits);
  });
  expectError("ERR_CBR_TOTAL_SIZE_LIMIT", [&] {
    validateEntryLimits(2, limits.maxTotalBytes - 1, 1, 1, limits);
  });
  expectError("ERR_CBR_ENTRY_COUNT_LIMIT", [&] {
    validateEntryLimits(1, 0, 1, limits.maxEntries + 1, limits);
  });
  return 0;
}
