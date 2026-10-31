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
    // Notifications are answered here first, before any plugin registers: then
    // firebase_messaging, which makes itself the delegate, keeps this one as the
    // delegate it passes everything that is not a push to — the push buttons and
    // the routine's alerts below, and through FlutterAppDelegate the local
    // notifications plugin (a routine alert shown while the app is open, a tap on
    // one). Without it none of them is ever called.
    UNUserNotificationCenter.current().delegate = self
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

    // The routine's alerts (lib/services/routine_alert_service.dart): Dart asks
    // for the "Mark as done" button's category, and is told when it was pressed.
    if let messenger = engineBridge.pluginRegistry.registrar(forPlugin: "RoutineAlerts")?.messenger() {
      let channel = FlutterMethodChannel(name: AppDelegate.routineChannel, binaryMessenger: messenger)
      channel.setMethodCallHandler { call, result in
        guard call.method == "setCategory",
          let arguments = call.arguments as? [String: Any],
          let id = arguments["id"] as? String,
          let action = arguments["action"] as? String,
          let label = arguments["label"] as? String
        else {
          result(FlutterMethodNotImplemented)
          return
        }
        AppDelegate.setRoutineCategory(id: id, action: action, label: label) {
          DispatchQueue.main.async { result(nil) }
        }
      }
      routineAlerts = channel
    }
  }

  private var pushActions: FlutterMethodChannel?
  private var pendingAction: [String: Any]?
  private var routineAlerts: FlutterMethodChannel?

  /// RoutineConfig.alertChannel, alertCategoryId, alertDoneActionId and
  /// alertTickPrefix; the payload keys are alertTaskKey and alertDayKey. Change
  /// them together.
  private static let routineChannel = "hariharibol/routine_alerts"
  private static let routineCategory = "routine_alert"
  private static let routineDoneAction = "routine_done"
  private static let routineTickPrefix = "routine.alertTick."

  /// Puts the routine alert's category beside the ones already registered —
  /// the push buttons' (NotificationService) — never in place of them. The
  /// button does not open the app: the press is written by
  /// `userNotificationCenter(_:didReceive:)` below.
  private static func setRoutineCategory(
    id: String, action: String, label: String, done: @escaping () -> Void
  ) {
    let center = UNUserNotificationCenter.current()
    center.getNotificationCategories { categories in
      var kept = categories.filter { $0.identifier != id }
      kept.insert(
        UNNotificationCategory(
          identifier: id,
          actions: [UNNotificationAction(identifier: action, title: label, options: [])],
          intentIdentifiers: [],
          options: []))
      center.setNotificationCategories(kept)
      done()
    }
  }

  /// A routine alert's "Mark as done", written where Dart reads it
  /// (lib/services/routine_alert_ticks.dart): one key per press in the
  /// shared_preferences store, `routine.alertTick.<day>.<task id>` → when, in
  /// milliseconds. Here and not in a Dart isolate, because the app may not be
  /// running and a press must not wait for one to start.
  private static func recordRoutineTick(_ userInfo: [AnyHashable: Any]) -> Bool {
    guard let payload = userInfo["payload"] as? String,
      let data = payload.data(using: .utf8),
      let fields = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
      let task = fields["routineTask"] as? String, !task.isEmpty,
      let day = fields["routineDay"] as? String, !day.isEmpty
    else { return false }
    let now = Int64((Date().timeIntervalSince1970 * 1000).rounded())
    UserDefaults.standard.set(now, forKey: "\(routineTickPrefix)\(day).\(task)")
    return true
  }

  /// A routine alert that comes while the app is open is shown, with its sound,
  /// and answered here once. Passed on, every plugin would answer it in turn —
  /// firebase_messaging with the push's foreground options, the local
  /// notifications plugin with its own — and the system takes only one answer.
  override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    if notification.request.content.categoryIdentifier == AppDelegate.routineCategory {
      completionHandler([.banner, .list, .sound])
      return
    }
    super.userNotificationCenter(center, willPresent: notification, withCompletionHandler: completionHandler)
  }

  override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let id = response.actionIdentifier
    if id == AppDelegate.routineDoneAction {
      // The app open picks it up at once; a closed one when it next opens.
      if AppDelegate.recordRoutineTick(response.notification.request.content.userInfo) {
        routineAlerts?.invokeMethod("ticked", arguments: nil)
      }
      completionHandler()
      return
    }
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
