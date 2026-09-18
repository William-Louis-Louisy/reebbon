#import "ReebbonCbrBridge.h"

#include "../native/reebbon_cbr.hpp"

namespace {

NSError *errorFromException(const reebbon::cbr::ExtractionError& exception) {
  NSString *code = [NSString stringWithUTF8String:exception.code().c_str()];
  NSString *message = [NSString stringWithUTF8String:exception.what()];
  return [NSError errorWithDomain:@"ReebbonCbr"
                             code:1
                         userInfo:@{
                           @"code" : code,
                           NSLocalizedDescriptionKey : message,
                         }];
}

}  // namespace

@implementation ReebbonCbrBridge

+ (nullable NSDictionary<NSString *, id> *)extractSourcePath:(NSString *)sourcePath
                                             destinationPath:(NSString *)destinationPath
                                                       error:(NSError **)error {
  try {
    const auto result = reebbon::cbr::extractToDirectory(
        sourcePath.UTF8String, destinationPath.UTF8String);
    return @{
      @"entryCount" : @(result.entryCount),
      @"fileCount" : @(result.fileCount),
      @"totalBytes" : @(result.totalBytes),
      @"solid" : @(result.solid),
    };
  } catch (const reebbon::cbr::ExtractionError& exception) {
    if (error != nullptr) {
      *error = errorFromException(exception);
    }
    return nil;
  }
}

+ (unsigned long long)maximumArchiveBytes {
  return reebbon::cbr::Limits{}.maxArchiveBytes;
}

@end
