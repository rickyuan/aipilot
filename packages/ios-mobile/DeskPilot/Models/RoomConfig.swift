import Foundation

struct RoomConfig: Codable {
    let sdkAppId: Int
    let roomId: String
    let userId: String
    let userSig: String
}

struct PairingResponse: Codable {
    let message: String
    let roomId: String
    let pcUserId: String
    let mobileRoomConfig: RoomConfig
    let pcRoomConfig: RoomConfig
}

struct RoomConfigResponse: Codable {
    let roomConfig: RoomConfig
}
