import Foundation

struct PairingCodeResult: Decodable {
    let code: String
    let expiresAt: String
}

struct PairingStatusResult: Decodable {
    let isPaired: Bool
    let deviceToken: String?
}

struct ClaimResult: Decodable {
    let success: Bool
    let deviceToken: String?
}

struct ManifestItem: Decodable {
    let contentId: String
    let r2Url: String
    let type: String // "video" | "image"
    let durationSeconds: Int
    let order: Int
}

struct HeartbeatResponse: Decodable {
    let manifestChanged: Bool
    let command: RemoteCommandDto?
}

struct RemoteCommandDto: Decodable {
    let commandType: String
    let payload: String?
}

actor ApiClient {
    private let storage: SecureStorage
    private var serverUrl: String { storage.getServerUrl() }

    init(storage: SecureStorage) {
        self.storage = storage
    }

    private func get<T: Decodable>(_ path: String) async throws -> T {
        let url = URL(string: serverUrl + path)!
        let (data, _) = try await URLSession.shared.data(from: url)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func post<B: Encodable, T: Decodable>(_ path: String, body: B) async throws -> T {
        let url = URL(string: serverUrl + path)!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = storage.getDeviceToken() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        req.httpBody = try JSONEncoder().encode(body)
        let (data, _) = try await URLSession.shared.data(for: req)
        return try JSONDecoder().decode(T.self, from: data)
    }

    // MARK: - Pairing

    func requestPairingCode() async throws -> PairingCodeResult {
        let deviceId = await UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
        return try await post("/api/v1/players/pairing/request", body: ["deviceFingerprint": deviceId])
    }

    func getPairingStatus(code: String) async throws -> PairingStatusResult {
        return try await get("/api/v1/players/pairing/status?code=\(code)")
    }

    func claimPairingCode(code: String) async throws -> ClaimResult {
        let deviceId = await UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
        return try await post("/api/v1/players/pairing/claim", body: ["code": code, "deviceFingerprint": deviceId])
    }

    // MARK: - Playback

    func getManifest() async throws -> [ManifestItem] {
        return try await get("/api/v1/players/manifest")
    }

    func postHeartbeat(currentContentId: String?) async throws -> HeartbeatResponse {
        return try await post("/api/v1/players/heartbeat", body: [
            "currentContentId": currentContentId ?? "",
            "playerVersion": "ios-1.0",
        ])
    }
}
