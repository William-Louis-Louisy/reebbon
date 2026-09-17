#import "ReebbonCbrPocBridge.h"

#include "../native/reebbon_cbr_poc.hpp"

namespace {

NSError *errorFromException(const reebbon::cbr::ExtractionError& exception) {
  NSString *code = [NSString stringWithUTF8String:exception.code().c_str()];
  NSString *message = [NSString stringWithUTF8String:exception.what()];
  return [NSError errorWithDomain:@"ReebbonCbrPoc"
                             code:1
                         userInfo:@{
                           @"code" : code,
                           NSLocalizedDescriptionKey : message,
                         }];
}

}  // namespace

@implementation ReebbonCbrPocBridge

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

+ (BOOL)cleanupDestinationPath:(NSString *)destinationPath
                         error:(NSError **)error {
  try {
    reebbon::cbr::cleanupDirectory(destinationPath.UTF8String);
    return YES;
  } catch (const reebbon::cbr::ExtractionError& exception) {
    if (error != nullptr) {
      *error = errorFromException(exception);
    }
    return NO;
  }
}

@end
