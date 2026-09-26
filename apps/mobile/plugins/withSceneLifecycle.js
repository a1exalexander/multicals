// iOS 27 SDK refuses to launch apps without the UIScene life cycle. Expo 57 ships ExpoAppSceneDelegate but its
// prebuild template still uses the app-delegate window; this ports the SDK 58 template (AppDelegate + SceneDelegate).
// ponytail: delete this plugin once on Expo SDK 58, whose template does it natively.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins')

const WINDOW_BLOCK = /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)[\s\S]*?#endif\n/

module.exports = function withSceneLifecycle(config) {
  config = withAppDelegate(config, (c) => {
    let src = c.modResults.contents
    if (c.modResults.language !== 'swift') throw new Error('withSceneLifecycle: expected a Swift AppDelegate')
    if (!src.includes('class SceneDelegate')) {
      src = src.replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {')
      if (!WINDOW_BLOCK.test(src)) throw new Error('withSceneLifecycle: AppDelegate template changed; update the plugin')
      src = src.replace(WINDOW_BLOCK, '    // SceneDelegate creates the window and starts React Native (scene life cycle).\n')
      src += '\n@objc(SceneDelegate)\nclass SceneDelegate: ExpoAppSceneDelegate {}\n'
    }
    c.modResults.contents = src
    return c
  })
  return withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          { UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate' }
        ]
      }
    }
    return c
  })
}
