import Flutter
import UIKit
import UserNotifications
import workmanager_apple

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // The silent book sync's background pass (lib/services/book_sync_background.dart).
    // The identifier must match BookSyncConfig.backgroundTaskId and Info.plist.
    WorkmanagerPlugin.registerBGProcessingTask(withIdentifier: "hariharibol.bookSync.once")
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)

    // A button under a push (see NotificationService) is pressed outside any
    // plugin's reach, so the press is handed to Dart on its own channel
    // (lib/services/push_actions.dart). One pressed before Dart is listening —
    // the app was closed — waits for it to ask.
    if let messenger = engineBridge.pluginRegistry.registrar(forPlugin: "PushActions")?.messenger() {
      let channel = FlutterMethodChannel(name: "hariharibol/push_actions", binaryMessenger: messenger)
      channel.setMethodCallHandler { [weak self] call, result in
        if call.method == "takePending" {
          result(self?.pendingAction)
          self?.pendingAction = nil
        } else {
          result(FlutterMethodNotImplemented)
        }
      }
      pushActions = channel
    }
  }

  private var pushActions: FlutterMethodChannel?
  private var pendingAction: [String: Any]?

  override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let id = response.actionIdentifier
    if id != UNNotificationDefaultActionIdentifier && id != UNNotificationDismissActionIdentifier {
      var data: [String: String] = [:]
      for (key, value) in response.notification.request.content.userInfo {
        if let key = key as? String, let value = value as? String { data[key] = value }
      }
      let action: [String: Any] = ["actionId": id, "data": data]
      if let channel = pushActions {
        channel.invokeMethod("action", arguments: action) { [weak self] reply in
          // Dart was not there to take it: keep it for when it asks.
          if reply is FlutterError || (reply as AnyObject) === (FlutterMethodNotImplemented as AnyObject) {
            self?.pendingAction = action
          }
        }
      } else {
        pendingAction = action
      }
    }
    super.userNotificationCenter(center, didReceive: response, withCompletionHandler: completionHandler)
  }
}
