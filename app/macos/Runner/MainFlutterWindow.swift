import Cocoa
import FlutterMacOS

class MainFlutterWindow: NSWindow {
  override func awakeFromNib() {
    let flutterViewController = FlutterViewController()
    let windowFrame = self.frame
    self.contentViewController = flutterViewController
    self.setFrame(windowFrame, display: true)

    // A desktop window opens roomy and cannot be squeezed below a phone's width,
    // so the layout never has to draw something smaller than the app was made for.
    self.contentMinSize = NSSize(width: 420, height: 640)
    self.setContentSize(NSSize(width: 1280, height: 820))
    self.center()

    RegisterGeneratedPlugins(registry: flutterViewController)

    super.awakeFromNib()
  }
}
