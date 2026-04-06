import Foundation
import Combine
import TXLiteAVSDK_Professional

class TRTCService: NSObject, ObservableObject {
    static let shared = TRTCService()

    // Published state for SwiftUI binding
    @Published var isConnected = false
    @Published var botStatus: BotStatus = .idle
    @Published var botSubtitle = ""
    @Published var messages: [ConversationMessage] = []
    @Published var remoteUsers: [String] = []
    @Published var screenAvailable = false
    @Published var screenUserId = ""
    @Published var isMicOn = false
    @Published var error: String?

    private var trtcCloud: TRTCCloud?
    private var currentConfig: RoomConfig?

    private override init() {
        super.init()
    }

    /// Initialize TRTC engine
    func initialize() {
        trtcCloud = TRTCCloud.sharedInstance()
        trtcCloud?.delegate = self
        print("[TRTC] Engine initialized")
    }

    /// Enter a TRTC room
    func enterRoom(config: RoomConfig) {
        if trtcCloud == nil { initialize() }
        currentConfig = config

        // Ensure audio plays through speaker (not earpiece)
        trtcCloud?.setAudioRoute(.modeSpeakerphone)

        let params = TRTCParams()
        params.sdkAppId = UInt32(config.sdkAppId)
        params.userId = config.userId
        params.userSig = config.userSig
        params.roomId = 0  // Use strRoomId
        params.strRoomId = config.roomId
        params.role = .anchor

        print("[TRTC] Entering room: \(config.roomId) as \(config.userId)")
        trtcCloud?.enterRoom(params, appScene: .videoCall)
    }

    /// Leave the current room
    func exitRoom() {
        stopMic()
        trtcCloud?.exitRoom()
        DispatchQueue.main.async {
            self.isConnected = false
            self.screenAvailable = false
            self.remoteUsers = []
            self.botStatus = .idle
            self.messages = []
        }
        print("[TRTC] Exiting room")
    }

    /// Start publishing microphone audio
    func startMic() {
        trtcCloud?.startLocalAudio(.speech)
        DispatchQueue.main.async { self.isMicOn = true }
        print("[TRTC] Mic started")
    }

    /// Stop publishing microphone audio
    func stopMic() {
        trtcCloud?.stopLocalAudio()
        DispatchQueue.main.async { self.isMicOn = false }
        print("[TRTC] Mic stopped")
    }

    /// Toggle mic on/off
    func toggleMic() {
        if isMicOn { stopMic() } else { startMic() }
    }

    /// Start rendering remote screen share into a UIView
    func startRemoteView(userId: String, streamType: TRTCVideoStreamType, view: UIView) {
        trtcCloud?.startRemoteView(userId, streamType: streamType, view: view)
        print("[TRTC] Started remote view for \(userId), streamType=\(streamType.rawValue)")
    }

    /// Stop rendering remote view
    func stopRemoteView(userId: String, streamType: TRTCVideoStreamType) {
        trtcCloud?.stopRemoteView(userId, streamType: streamType)
    }

    /// Parse a TRTC custom message
    private func handleCustomMessage(data: Data) {
        guard let jsonStr = String(data: data, encoding: .utf8),
              let jsonData = jsonStr.data(using: .utf8) else { return }

        do {
            let raw = try JSONSerialization.jsonObject(with: jsonData) as? [String: Any]
            guard let type = raw?["type"] as? Int,
                  let payload = raw?["payload"] as? [String: Any] else { return }

            DispatchQueue.main.async {
                switch type {
                case 10000: // Bot subtitle
                    let text = payload["text"] as? String ?? ""
                    let end = payload["end"] as? Bool ?? false
                    let roundId = payload["roundid"] as? String ?? ""
                    self.botSubtitle = text
                    self.updateMessage(roundId: roundId, aiText: text, isCompleted: end)

                case 10001: // Bot status
                    let state = payload["state"] as? Int ?? 0
                    let roundId = payload["roundid"] as? String ?? ""
                    self.botStatus = BotStatus.from(state: state)
                    if self.botStatus == .listening && !roundId.isEmpty {
                        self.ensureMessage(roundId: roundId)
                    }

                case 10002: // User subtitle (ASR)
                    let text = payload["text"] as? String ?? ""
                    let roundId = payload["roundid"] as? String ?? ""
                    self.updateMessage(roundId: roundId, userText: text)

                default:
                    break
                }
            }
        } catch {
            print("[TRTC] Failed to parse custom message: \(error)")
        }
    }

    private func updateMessage(roundId: String, userText: String? = nil, aiText: String? = nil, isCompleted: Bool = false) {
        if let idx = messages.firstIndex(where: { $0.id == roundId }) {
            if let text = userText { messages[idx].userText = text }
            if let text = aiText { messages[idx].aiText = text }
            if isCompleted { messages[idx].isCompleted = true }
        } else {
            messages.append(ConversationMessage(
                roundId: roundId,
                userText: userText ?? "",
                aiText: aiText ?? ""
            ))
        }
    }

    private func ensureMessage(roundId: String) {
        if !messages.contains(where: { $0.id == roundId }) {
            messages.append(ConversationMessage(roundId: roundId))
        }
    }

    /// Cleanup
    func destroy() {
        exitRoom()
        TRTCCloud.destroySharedInstance()
        trtcCloud = nil
    }
}

// MARK: - TRTCCloudDelegate

extension TRTCService: TRTCCloudDelegate {

    func onEnterRoom(_ result: Int) {
        print("[TRTC] onEnterRoom: \(result)")
        DispatchQueue.main.async {
            if result > 0 {
                self.isConnected = true
                self.error = nil
                // Ensure we can hear remote audio (bot TTS)
                self.trtcCloud?.muteAllRemoteAudio(false)
                self.trtcCloud?.setAudioPlayoutVolume(100)
                self.startMic()
            } else {
                self.isConnected = false
                self.error = "Failed to enter room (code: \(result))"
            }
        }
    }

    func onExitRoom(_ reason: Int) {
        print("[TRTC] onExitRoom: reason=\(reason)")
        DispatchQueue.main.async {
            self.isConnected = false
        }
    }

    func onRemoteUserEnterRoom(_ userId: String) {
        print("[TRTC] Remote user entered: \(userId)")
        DispatchQueue.main.async {
            if !self.remoteUsers.contains(userId) {
                self.remoteUsers.append(userId)
            }
        }
    }

    func onRemoteUserLeaveRoom(_ userId: String, reason: Int) {
        print("[TRTC] Remote user left: \(userId)")
        DispatchQueue.main.async {
            self.remoteUsers.removeAll { $0 == userId }
            if userId == self.screenUserId {
                self.screenAvailable = false
                self.screenUserId = ""
            }
        }
    }

    func onUserVideoAvailable(_ userId: String, available: Bool) {
        print("[TRTC] User video available: \(userId) = \(available)")
        if userId.hasSuffix("_screen") {
            DispatchQueue.main.async {
                self.screenAvailable = available
                self.screenUserId = available ? userId : ""
            }
        }
    }

    func onUserSubStreamAvailable(_ userId: String, available: Bool) {
        print("[TRTC] User sub-stream available: \(userId) = \(available)")
        DispatchQueue.main.async {
            self.screenAvailable = available
            self.screenUserId = available ? userId : ""
        }
    }

    func onUserAudioAvailable(_ userId: String, available: Bool) {
        print("[TRTC] User audio available: \(userId) = \(available)")
    }

    func onRecvCustomCmdMsgUserId(_ userId: String, cmdID: Int, seq: UInt32, message: Data) {
        handleCustomMessage(data: message)
    }

    func onError(_ errCode: TXLiteAVError, errMsg: String?, extInfo: [AnyHashable: Any]?) {
        print("[TRTC] Error \(errCode.rawValue): \(errMsg ?? "")")
        DispatchQueue.main.async {
            self.error = "TRTC Error \(errCode.rawValue): \(errMsg ?? "")"
        }
    }

    func onWarning(_ warningCode: TXLiteAVWarning, warningMsg: String?, extInfo: [AnyHashable: Any]?) {
        print("[TRTC] Warning \(warningCode.rawValue): \(warningMsg ?? "")")
    }
}
