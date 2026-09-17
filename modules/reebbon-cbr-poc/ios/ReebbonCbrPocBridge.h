#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface ReebbonCbrPocBridge : NSObject

+ (nullable NSDictionary<NSString *, id> *)extractSourcePath:(NSString *)sourcePath
                                             destinationPath:(NSString *)destinationPath
                                                       error:(NSError **)error;
+ (BOOL)cleanupDestinationPath:(NSString *)destinationPath
                         error:(NSError **)error;

@end

NS_ASSUME_NONNULL_END
