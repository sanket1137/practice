import SwiftUI
import CoreImage.CIFilterBuiltins

@MainActor
class PairingViewModel: ObservableObject {
    @Published var pairingCode: String?
    @Published var qrImage: UIImage?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var manualCode = ""

    private let storage = SecureStorage()
    private lazy var apiClient = ApiClient(storage: storage)
    private var pollTask: Task<Void, Never>?

    func startPairing() async {
        isLoading = true
        errorMessage = nil
        do {
            let result = try await apiClient.requestPairingCode()
            pairingCode = result.code
            qrImage = generateQR(from: result.code)
            isLoading = false
            startPolling(code: result.code)
        } catch {
            isLoading = false
            errorMessage = error.localizedDescription
        }
    }

    func pairManually(appState: AppState) async {
        guard manualCode.count >= 6 else { return }
        isLoading = true
        do {
            let result = try await apiClient.claimPairingCode(code: manualCode.uppercased())
            if result.success, let token = result.deviceToken {
                storage.setDeviceToken(token)
                appState.onPaired()
            } else {
                errorMessage = "Pairing failed. Check the code and try again."
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func startPolling(code: String) {
        pollTask?.cancel()
        pollTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 5_000_000_000) // 5 seconds
                if Task.isCancelled { break }
                do {
                    let status = try await apiClient.getPairingStatus(code: code)
                    if status.isPaired, let token = status.deviceToken {
                        storage.setDeviceToken(token)
                        // Notify via NotificationCenter since we cant hold AppState here
                        NotificationCenter.default.post(name: .devicePaired, object: nil)
                        break
                    }
                } catch { /* ignore transient errors */ }
            }
        }
    }

    private func generateQR(from string: String) -> UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"
        guard let outputImage = filter.outputImage else { return nil }
        let scaled = outputImage.transformed(by: CGAffineTransform(scaleX: 10, y: 10))
        guard let cgImage = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}

extension Notification.Name {
    static let devicePaired = Notification.Name("DevicePaired")
}
