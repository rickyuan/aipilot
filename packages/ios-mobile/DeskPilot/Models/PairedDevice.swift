import Foundation
import UIKit

/// Represents a PC that has been paired with this mobile device.
/// Stored in UserDefaults for one-tap reconnection.
struct PairedDevice: Codable {
    let pcId: String
    let pairingCode: String
    let roomId: String
    let displayName: String
    let pairedAt: Date

    var roomConfig: RoomConfig?
}

/// Manages paired device storage in UserDefaults
class PairedDeviceStore {
    private static let key = "com.deskpilot.pairedDevice"
    private static let mobileIdKey = "com.deskpilot.mobileUserId"

    static func save(_ device: PairedDevice) {
        if let data = try? JSONEncoder().encode(device) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    static func load() -> PairedDevice? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(PairedDevice.self, from: data)
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }

    static var hasPairedDevice: Bool {
        load() != nil
    }

    /// Returns a persistent mobile user ID (generated once, reused forever).
    /// This ensures the TRTC Bot's targetUserId always matches.
    static var mobileUserId: String {
        if let existing = UserDefaults.standard.string(forKey: mobileIdKey) {
            return existing
        }
        let newId = "mobile_\(UIDevice.current.name.replacingOccurrences(of: " ", with: "_"))_\(Int(Date().timeIntervalSince1970))"
        UserDefaults.standard.set(newId, forKey: mobileIdKey)
        return newId
    }
}
