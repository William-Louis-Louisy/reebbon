#include "reebbon_cbr.hpp"

#include <iostream>
#include <string>
#include <sys/resource.h>

namespace {

long peakResidentSetKilobytes() {
  rusage usage{};
  return getrusage(RUSAGE_SELF, &usage) == 0 ? usage.ru_maxrss : -1;
}

}  // namespace

int main(int argumentCount, char** arguments) {
  if (argumentCount != 4) {
    std::cerr << "usage: reebbon-cbr-fixture-runner ARCHIVE DESTINATION "
                 "EXPECTED_CODE_OR_OK\n";
    return 64;
  }

  const std::string archive = arguments[1];
  const std::string destination = arguments[2];
  const std::string expected = arguments[3];
  try {
    const auto result =
        reebbon::cbr::extractToDirectory(archive, destination);
    std::cout << "OK"
              << " entries=" << result.entryCount
              << " files=" << result.fileCount
              << " bytes=" << result.totalBytes
              << " solid=" << (result.solid ? "true" : "false")
              << " peakRssKb=" << peakResidentSetKilobytes() << '\n';
    reebbon::cbr::cleanupDirectory(destination);
    return expected == "OK" ? 0 : 2;
  } catch (const reebbon::cbr::ExtractionError& error) {
    std::cout << error.code() << ' ' << error.what() << '\n';
    return expected == error.code() ? 0 : 3;
  }
}
