import UserNotifications

/// Finishes a push on the way to the screen: downloads its picture and attaches it,
/// and turns the `actions` the push carries into the buttons under it.
///
/// Runs only for pushes sent with `mutable-content` (`backend/utils/push-message.js`
/// sets it when there is a picture or buttons). Whatever goes wrong here — no
/// network, a picture that is too big, bad JSON — the push is still delivered with
/// the words it came with; this must never be the reason one is lost.
///
/// A button's press is handled by the app (`AppDelegate`), which opens that button's
/// own link.
class NotificationService: UNNotificationServiceExtension {
  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var content: UNMutableNotificationContent?

  // The system gives an extension about 30 seconds and a small memory budget.
  private let maxImageBytes: Int64 = 5 * 1024 * 1024

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    self.contentHandler = contentHandler
    guard let mutable = request.content.mutableCopy() as? UNMutableNotificationContent else {
      contentHandler(request.content)
      return
    }
    content = mutable

    registerButtons(for: mutable, pushId: request.identifier)

    guard let url = imageURL(in: mutable.userInfo) else {
      contentHandler(mutable)
      return
    }
    download(url) { [weak self] attachment in
      if let attachment = attachment { mutable.attachments = [attachment] }
      self?.contentHandler?(mutable)
    }
  }

  // Out of time: deliver what there is, with or without the picture.
  override func serviceExtensionTimeWillExpire() {
    if let content = content { contentHandler?(content) }
  }

  // FCM puts the picture under `fcm_options.image`; the data copy is the fallback.
  private func imageURL(in userInfo: [AnyHashable: Any]) -> URL? {
    let options = userInfo["fcm_options"] as? [String: Any]
    let text = (options?["image"] as? String) ?? (userInfo["image"] as? String)
    guard let text = text, let url = URL(string: text), url.scheme == "https" else { return nil }
    return url
  }

  private func registerButtons(for content: UNMutableNotificationContent, pushId: String) {
    guard
      let raw = content.userInfo["actions"] as? String,
      let data = raw.data(using: .utf8),
      let list = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
    else { return }

    let actions: [UNNotificationAction] = list.prefix(2).compactMap { item in
      guard let id = item["id"] as? String, let label = item["label"] as? String else { return nil }
      // `.foreground` opens the app, which then opens the button's link.
      return UNNotificationAction(identifier: id, title: label, options: [.foreground])
    }
    if actions.isEmpty { return }

    let category = UNNotificationCategory(
      identifier: "hhb.\(pushId)",
      actions: actions,
      intentIdentifiers: [],
      options: []
    )
    let center = UNUserNotificationCenter.current()
    center.getNotificationCategories { existing in
      // Keep the last few so a pile of unread pushes does not grow the set for ever.
      let mine = existing.filter { $0.identifier.hasPrefix("hhb.") }.suffix(20)
      let others = existing.filter { !$0.identifier.hasPrefix("hhb.") }
      center.setNotificationCategories(Set(others).union(mine).union([category]))
    }
    content.categoryIdentifier = category.identifier
  }

  private func download(_ url: URL, completion: @escaping (UNNotificationAttachment?) -> Void) {
    let config = URLSessionConfiguration.ephemeral
    config.timeoutIntervalForRequest = 15
    URLSession(configuration: config).downloadTask(with: url) { [maxImageBytes] file, response, _ in
      guard
        let file = file,
        let http = response as? HTTPURLResponse, http.statusCode == 200,
        (try? FileManager.default.attributesOfItem(atPath: file.path)[.size] as? Int64) ?? 0 <= maxImageBytes
      else { return completion(nil) }

      // The system decides how to read the file by its extension.
      let ext: String
      switch response?.mimeType {
      case "image/png": ext = "png"
      case "image/webp": ext = "webp"
      case "image/gif": ext = "gif"
      default: ext = "jpg"
      }
      let target = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("\(UUID().uuidString).\(ext)")
      do {
        try FileManager.default.moveItem(at: file, to: target)
        completion(try UNNotificationAttachment(identifier: "image", url: target))
      } catch {
        completion(nil)
      }
    }.resume()
  }
}
