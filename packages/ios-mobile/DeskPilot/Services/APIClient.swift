import Foundation

enum APIError: LocalizedError {
    case invalidResponse(Int)
    case serverError(String)
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidResponse(let code): return "Server returned \(code)"
        case .serverError(let msg): return msg
        case .networkError(let err): return err.localizedDescription
        }
    }
}

class APIClient {
    // Change this to your Mac's LAN IP for development
    #if DEBUG
    static let baseURL = "http://192.168.1.73:3000"
    #else
    static let baseURL = "https://your-cloud-server.com"
    #endif

    /// Verifies a 6-digit pairing code and returns room config.
    static func verifyPairingCode(code: String, mobileUserId: String) async throws -> PairingResponse {
        let url = URL(string: "\(baseURL)/api/pairing/verify")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["pairingCode": code, "mobileUserId": mobileUserId]
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)
        let httpResponse = response as! HTTPURLResponse

        if httpResponse.statusCode != 200 {
            if let errorBody = try? JSONDecoder().decode([String: String].self, from: data),
               let errorMsg = errorBody["error"] {
                throw APIError.serverError(errorMsg)
            }
            throw APIError.invalidResponse(httpResponse.statusCode)
        }

        return try JSONDecoder().decode(PairingResponse.self, from: data)
    }

    /// Requests PC to start screen sharing.
    static func requestScreenShare(roomId: String, mobileUserId: String) async throws {
        let encodedRoomId = roomId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? roomId
        let url = URL(string: "\(baseURL)/api/screen-share/\(encodedRoomId)/start")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["mobileUserId": mobileUserId])
        let (_, response) = try await URLSession.shared.data(for: request)
        let httpResponse = response as! HTTPURLResponse
        guard httpResponse.statusCode == 200 else {
            throw APIError.invalidResponse(httpResponse.statusCode)
        }
    }

    /// Requests PC to stop screen sharing.
    static func stopScreenShare(roomId: String, mobileUserId: String) async throws {
        let encodedRoomId = roomId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? roomId
        let url = URL(string: "\(baseURL)/api/screen-share/\(encodedRoomId)/stop")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["mobileUserId": mobileUserId])
        let (_, response) = try await URLSession.shared.data(for: request)
        let httpResponse = response as! HTTPURLResponse
        guard httpResponse.statusCode == 200 else {
            throw APIError.invalidResponse(httpResponse.statusCode)
        }
    }

    /// Gets TRTC room config for a specific user.
    static func getRoomConfig(roomId: String, userId: String) async throws -> RoomConfig {
        let encodedRoomId = roomId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? roomId
        let encodedUserId = userId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? userId
        let url = URL(string: "\(baseURL)/api/rooms/\(encodedRoomId)/config?userId=\(encodedUserId)")!

        let (data, response) = try await URLSession.shared.data(from: url)
        let httpResponse = response as! HTTPURLResponse

        guard httpResponse.statusCode == 200 else {
            throw APIError.invalidResponse(httpResponse.statusCode)
        }

        let decoded = try JSONDecoder().decode(RoomConfigResponse.self, from: data)
        return decoded.roomConfig
    }
}
