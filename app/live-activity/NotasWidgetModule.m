//
//  NotasWidgetModule.m
//  Expone NotasWidgetModule (Swift) a React Native.
//  Pertenece SOLO al target "GrowthManager".
//
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(NotasWidgetModule, NSObject)

RCT_EXTERN_METHOD(setNotas:(NSString *)json)

@end
