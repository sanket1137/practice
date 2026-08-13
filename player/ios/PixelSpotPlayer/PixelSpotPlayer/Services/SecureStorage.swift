import Foundation
import Security

/// Wraps iOS Keychain for persistent, encrypted device token storage.
struct SecureStorage {
    private let service = "in.pixelspot.player"
    private let tokenKey = "device_token"
    private let serverKey = "server_url"

    func hasDeviceToken() -> Bool {
        return readString(key: tokenKey) != nil
    }

    func getDeviceToken() -> String? {
        return readString(key: tokenKey)
    }

    func setDeviceToken(_ token: String) {
        writeString(key: tokenKey, value: token)
    }

    func clearDeviceToken() {
        delete(key: tokenKey)
    }

    func getServerUrl() -> String {
        return readString(key: serverKey) ?? "https://ccms.pixelspot.in"
    }

    func setServerUrl(_ url: String) {
        writeString(key: serverKey, value: url)
    }

    // MARK: - Keychain helpers

    private func writeString(key: String, value: String) {
        let data = value.data(using: .utf8)!
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]

        // Try to update first
        let updateAttribs: [String: Any] = [kSecValueData as String: data]
        let updateStatus = SecItemUpdate(query as CFDictionary, updateAttribs as CFDictionary)

        if updateStatus == errSecItemNotFound {
            query[kSecValueData as String] = data
            SecItemAdd(query as CFDictionary, nil)
        }
    }

    private func readString(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
