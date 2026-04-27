enum Flavor {
  dev,
  staging,
  prod,
}

class F {
  static Flavor? appFlavor;

  static String get name => appFlavor?.name ?? '';

  static String get title {
    switch (appFlavor) {
      case Flavor.dev:
        return 'Hari Hari Bol Dev';
      case Flavor.staging:
        return 'Hari Hari Bol Staging';
      case Flavor.prod:
        return 'Hari Hari Bol';
      default:
        return 'title';
    }
  }
}