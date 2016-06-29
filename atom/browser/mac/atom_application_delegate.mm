// Copyright (c) 2013 GitHub, Inc.
// Use of this source code is governed by the MIT license that can be
// found in the LICENSE file.

#import "atom/browser/mac/atom_application_delegate.h"

#import "atom/browser/mac/atom_application.h"
#include "atom/browser/browser.h"
#include "atom/browser/mac/dict_util.h"
#include "base/strings/sys_string_conversions.h"
#include "base/values.h"

@implementation AtomApplicationDelegate

- (id)init {
  self = [super init];
  menu_controller_.reset([[AtomMenuController alloc] init]);
  return self;
}

- (void)setApplicationDockMenu:(ui::MenuModel*)model {
  [menu_controller_ populateWithModel:model];
}

- (void)applicationWillFinishLaunching:(NSNotification*)notify {
  // Don't add the "Enter Full Screen" menu item automatically.
  [[NSUserDefaults standardUserDefaults] setBool:NO forKey:@"NSFullScreenMenuItemEverywhere"];

  atom::Browser::Get()->WillFinishLaunching();
}

- (void)applicationDidFinishLaunching:(NSNotification*)notify {
  atom::Browser::Get()->DidFinishLaunching();
}

- (NSMenu*)applicationDockMenu:(NSApplication*)sender {
  return [menu_controller_ menu];
}

- (BOOL)application:(NSApplication*)sender
           openFile:(NSString*)filename {
  std::string filename_str(base::SysNSStringToUTF8(filename));
  return atom::Browser::Get()->OpenFile(filename_str) ? YES : NO;
}

- (NSApplicationTerminateReply)applicationShouldTerminate:(NSApplication*)sender {
  atom::Browser* browser = atom::Browser::Get();
  if (browser->is_quiting()) {
    return NSTerminateNow;
  } else {
    // System started termination.
    atom::Browser::Get()->Quit();
    return NSTerminateCancel;
  }
}

- (BOOL)applicationShouldHandleReopen:(NSApplication*)theApplication
                    hasVisibleWindows:(BOOL)flag {
  atom::Browser* browser = atom::Browser::Get();
  browser->Activate(static_cast<bool>(flag));
  return flag;
}

-  (BOOL)application:(NSApplication*)sender
continueUserActivity:(NSUserActivity*)userActivity
  restorationHandler:(void (^)(NSArray*restorableObjects))restorationHandler {
  std::string activity_type(base::SysNSStringToUTF8(userActivity.activityType));
  std::unique_ptr<base::DictionaryValue> user_info =
      atom::NSDictionaryToDictionaryValue(userActivity.userInfo);
  if (!user_info)
    return NO;

  atom::Browser* browser = atom::Browser::Get();
  return browser->ContinueUserActivity(activity_type, *user_info) ? YES : NO;
}

- (void)application:(NSApplication *)application
  didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {

  const unsigned *tokenBytes = (const unsigned *)[deviceToken bytes];
  NSString *hexToken = [NSString stringWithFormat:@"%08x%08x%08x%08x%08x%08x%08x%08x",
                       ntohl(tokenBytes[0]), ntohl(tokenBytes[1]), ntohl(tokenBytes[2]),
                       ntohl(tokenBytes[3]), ntohl(tokenBytes[4]), ntohl(tokenBytes[5]),
                       ntohl(tokenBytes[6]), ntohl(tokenBytes[7])];

  std::string token_str(base::SysNSStringToUTF8(hexToken));

  atom::Browser* browser = atom::Browser::Get();
  browser->RemoteNotificationTokenRegistered(token_str);
}

- (void)application:(NSApplication *)application
  didFailToRegisterForRemoteNotificationsWithError:(NSError *)error {

  std::string description_str(base::SysNSStringToUTF8([error localizedDescription]));
  std::string domain_str(base::SysNSStringToUTF8([error domain]));
  std::unique_ptr<base::DictionaryValue> user_info =
      atom::NSDictionaryToDictionaryValue([error userInfo]);

  atom::Browser* browser = atom::Browser::Get();
  browser->RemoteNotificationTokenRegistrationFailed(
    description_str, [error code], domain_str, *user_info
  );
}

- (void)application:(NSApplication *)application
  didReceiveRemoteNotification:(NSDictionary *)userInfo {

  std::unique_ptr<base::DictionaryValue> user_info =
      atom::NSDictionaryToDictionaryValue(userInfo);

  atom::Browser* browser = atom::Browser::Get();
  browser->RemoteNotificationReceived(*user_info);
}

@end
