//
//  LiveActivityModule.m
//  Expone LiveActivityModule (Swift) a React Native.
//  Pertenece SOLO al target "GrowthManager".
//
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(LiveActivityModule, NSObject)

RCT_EXTERN_METHOD(start:(double)metros
                  segundos:(double)segundos)

RCT_EXTERN_METHOD(update:(double)metros
                  segundos:(double)segundos)

RCT_EXTERN_METHOD(end)

@end
