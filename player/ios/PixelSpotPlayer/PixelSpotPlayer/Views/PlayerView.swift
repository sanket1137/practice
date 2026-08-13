import SwiftUI
import AVKit

struct PlayerView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var viewModel = PlayerViewModel()

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if let videoUrl = viewModel.currentVideoUrl {
                VideoPlayer(player: AVPlayer(url: videoUrl))
                    .ignoresSafeArea()
            } else if let imageUrl = viewModel.currentImageUrl {
                AsyncImage(url: imageUrl) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable().scaledToFill().ignoresSafeArea()
                    default:
                        Color.black
                    }
                }
            } else {
                VStack(spacing: 16) {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(2)
                    Text("Loading content...")
                        .foregroundColor(.white.opacity(0.6))
                }
            }
        }
        .statusBar(hidden: true)
        .task { await viewModel.start(appState: appState) }
        .onReceive(NotificationCenter.default.publisher(for: .devicePaired)) { _ in
            Task { await viewModel.start(appState: appState) }
        }
    }
}

@MainActor
class PlayerViewModel: ObservableObject {
    @Published var currentVideoUrl: URL?
    @Published var currentImageUrl: URL?

    private let storage = SecureStorage()
    private lazy var apiClient = ApiClient(storage: storage)
    private var heartbeatTask: Task<Void, Never>?

    func start(appState: AppState) async {
        await syncManifest()
        startHeartbeat(appState: appState)
    }

    private func syncManifest() async {
        do {
            let items = try await apiClient.getManifest()
            if let first = items.first {
                let url = URL(string: first.r2Url)!
                if first.type == "video" {
                    currentVideoUrl = url
                    currentImageUrl = nil
                } else {
                    currentImageUrl = url
                    currentVideoUrl = nil
                }
            }
        } catch { /* retry on next heartbeat */ }
    }

    private func startHeartbeat(appState: AppState) {
        heartbeatTask?.cancel()
        heartbeatTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000) // 30s
                guard !Task.isCancelled else { break }
                do {
                    let response = try await apiClient.postHeartbeat(currentContentId: nil)
                    if response.manifestChanged { await syncManifest() }
                    if let cmd = response.command {
                        handleCommand(cmd, appState: appState)
                    }
                } catch { /* ignore transient errors */ }
            }
        }
    }

    private func handleCommand(_ cmd: RemoteCommandDto, appState: AppState) {
        switch cmd.commandType.lowercased() {
        case "unpair":
            heartbeatTask?.cancel()
            appState.onUnpaired()
        case "refreshmanifest":
            Task { await syncManifest() }
        default: break
        }
    }
}
