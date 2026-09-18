#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface ReebbonCbrBridge : NSObject

+ (nullable NSDictionary<NSString *, id> *)extractSourcePath:(NSString *)sourcePath
                                             destinationPath:(NSString *)destinationPath
                                                       error:(NSError **)error;

+ (unsigned long long)maximumArchiveBytes;

@end

NS_ASSUME_NONNULL_END
