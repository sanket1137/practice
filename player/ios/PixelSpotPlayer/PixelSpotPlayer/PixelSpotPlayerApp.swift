import SwiftUI

@main
struct PixelSpotPlayerApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            if appState.isPaired {
                PlayerView()
                    .environmentObject(appState)
            } else {
                PairingView()
                    .environmentObject(appState)
            }
        }
    }
}

@MainActor
class AppState: ObservableObject {
    @Published var isPaired: Bool = false

    private let storage = SecureStorage()

    init() {
        isPaired = storage.hasDeviceToken()
    }

    func onPaired() {
        isPaired = true
    }

    func onUnpaired() {
        storage.clearDeviceToken()
        isPaired = false
    }
}
