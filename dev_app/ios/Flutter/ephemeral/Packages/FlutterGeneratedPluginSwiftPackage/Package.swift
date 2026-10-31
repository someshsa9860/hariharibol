// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.
//
// Generated file. Do not edit.
//

import PackageDescription

let package = Package(
    name: "FlutterGeneratedPluginSwiftPackage",
    platforms: [
        .iOS("13.0")
    ],
    products: [
        .library(name: "FlutterGeneratedPluginSwiftPackage", type: .static, targets: ["FlutterGeneratedPluginSwiftPackage"])
    ],
    dependencies: [
        .package(name: "device_info_plus", path: "../.packages/device_info_plus-13.3.0"),
        .package(name: "firebase_app_check", path: "../.packages/firebase_app_check-0.4.8"),
        .package(name: "firebase_core", path: "../.packages/firebase_core-4.15.0"),
        .package(name: "firebase_messaging", path: "../.packages/firebase_messaging-16.7.0"),
        .package(name: "flutter_secure_storage_darwin", path: "../.packages/flutter_secure_storage_darwin-0.4.3"),
        .package(name: "google_sign_in_ios", path: "../.packages/google_sign_in_ios-6.3.8"),
        .package(name: "package_info_plus", path: "../.packages/package_info_plus-10.2.2"),
        .package(name: "FlutterFramework", path: "../.packages/FlutterFramework")
    ],
    targets: [
        .target(
            name: "FlutterGeneratedPluginSwiftPackage",
            dependencies: [
                .product(name: "device-info-plus", package: "device_info_plus"),
                .product(name: "firebase-app-check", package: "firebase_app_check"),
                .product(name: "firebase-core", package: "firebase_core"),
                .product(name: "firebase-messaging", package: "firebase_messaging"),
                .product(name: "flutter-secure-storage-darwin", package: "flutter_secure_storage_darwin"),
                .product(name: "google-sign-in-ios", package: "google_sign_in_ios"),
                .product(name: "package-info-plus", package: "package_info_plus"),
                .product(name: "FlutterFramework", package: "FlutterFramework")
            ]
        )
    ]
)
