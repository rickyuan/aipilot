import SwiftUI

struct RemoteScreen: View {
    let roomId: String
    let pcUserId: String
    let roomConfig: RoomConfig

    @ObservedObject private var trtcService = TRTCService.shared
    @State private var showControls = true
    @State private var isLandscape = false
    @State private var mobileUserId = "mobile_\(Int(Date().timeIntervalSince1970))"
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Color.black.ignoresSafeArea()

                ScreenViewer(pcUserId: pcUserId)
                    .ignoresSafeArea()
                    .onTapGesture {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            showControls.toggle()
                        }
                    }

                if showControls {
                    VStack {
                        topToolbar
                        Spacer()
                    }
                    .ignoresSafeArea(edges: .bottom)

                    VStack {
                        Spacer()
                        bottomControls
                    }
                    .ignoresSafeArea(edges: .bottom)
                }

                // Conversation overlay — bottom-right corner
                if !trtcService.messages.isEmpty {
                    VStack {
                        Spacer()
                        HStack {
                            Spacer()
                            CompactConversation(messages: trtcService.messages)
                                .frame(maxWidth: min(geo.size.width * 0.45, 200))
                                .frame(maxHeight: 120)
                                .padding(.trailing, 12)
                                .padding(.bottom, showControls ? 88 : 16)
                        }
                    }
                }
            }
        }
        .navigationBarHidden(true)
        .statusBarHidden()
        .onAppear {
            mobileUserId = roomConfig.userId
            // Request screen share from PC, then join room
            Task {
                try? await APIClient.requestScreenShare(roomId: roomId, mobileUserId: mobileUserId)
            }
            trtcService.enterRoom(config: roomConfig)
            setOrientation(landscape: false) // Allow landscape
        }
        .onDisappear {
            // Stop screen share and leave room
            Task {
                try? await APIClient.stopScreenShare(roomId: roomId, mobileUserId: mobileUserId)
            }
            trtcService.exitRoom()
            setOrientation(landscape: false)
        }
    }

    // MARK: - Top toolbar

    private var topToolbar: some View {
        HStack(spacing: 12) {
            Button(action: { dismiss() }) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(width: 32, height: 32)
                    .background(.ultraThinMaterial)
                    .clipShape(Circle())
            }

            HStack(spacing: 5) {
                Circle()
                    .fill(trtcService.isConnected ? .green : .red)
                    .frame(width: 6, height: 6)
                Text(trtcService.isConnected ? "Connected" : "Disconnected")
                    .font(.system(size: 11))
                    .foregroundColor(.white.opacity(0.8))
            }

            if trtcService.botStatus != .idle {
                HStack(spacing: 4) {
                    Circle().fill(statusColor).frame(width: 6, height: 6)
                    Text(trtcService.botStatus.displayText)
                        .font(.system(size: 11))
                        .foregroundColor(.white.opacity(0.8))
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(statusColor.opacity(0.15))
                .background(.ultraThinMaterial)
                .cornerRadius(10)
            }

            Spacer()

            Button(action: toggleOrientation) {
                Image(systemName: isLandscape ? "rectangle.portrait" : "rectangle.landscape.rotate")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)
                    .frame(width: 32, height: 32)
                    .background(.ultraThinMaterial)
                    .clipShape(Circle())
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    // MARK: - Bottom controls

    private var bottomControls: some View {
        HStack(spacing: 16) {
            // Mic button
            Button(action: { trtcService.toggleMic() }) {
                Image(systemName: trtcService.isMicOn ? "mic.fill" : "mic.slash.fill")
                    .font(.system(size: 18))
                    .foregroundColor(.white)
                    .frame(width: 48, height: 48)
                    .background(micColor.opacity(0.3))
                    .overlay(Circle().stroke(micColor, lineWidth: 1.5))
                    .clipShape(Circle())
            }

            VStack(alignment: .leading, spacing: 1) {
                Text(micLabel)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.white.opacity(0.9))
                if !trtcService.botSubtitle.isEmpty {
                    Text(String(trtcService.botSubtitle.prefix(60)))
                        .font(.system(size: 10))
                        .foregroundColor(.white.opacity(0.5))
                        .lineLimit(1)
                }
            }

            Spacer()

            // Disconnect button
            Button(action: { dismiss() }) {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)
                    .frame(width: 36, height: 36)
                    .background(Color.red.opacity(0.3))
                    .overlay(Circle().stroke(Color.red, lineWidth: 1.5))
                    .clipShape(Circle())
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
    }

    // MARK: - Helpers

    private var statusColor: Color {
        switch trtcService.botStatus {
        case .listening: return .green
        case .thinking: return .yellow
        case .speaking: return .blue
        case .interrupted: return .red
        case .idle: return .gray
        }
    }

    private var micColor: Color {
        if trtcService.botStatus == .thinking || trtcService.botStatus == .speaking {
            return .yellow
        }
        return trtcService.isMicOn ? .green : .gray
    }

    private var micLabel: String {
        switch trtcService.botStatus {
        case .thinking: return "Processing..."
        case .speaking: return "Speaking..."
        case .listening: return "Listening"
        default: return trtcService.isMicOn ? "Ready" : "Mic off"
        }
    }

    private func toggleOrientation() {
        isLandscape.toggle()
        setOrientation(landscape: isLandscape)
    }

    private func setOrientation(landscape: Bool) {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene else { return }
        let orientations: UIInterfaceOrientationMask = landscape ? .landscape : .all
        let prefs = UIWindowScene.GeometryPreferences.iOS(interfaceOrientations: orientations)
        windowScene.requestGeometryUpdate(prefs) { _ in }
    }
}

// MARK: - Compact conversation overlay

struct CompactConversation: View {
    let messages: [ConversationMessage]

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .trailing, spacing: 3) {
                    ForEach(Array(messages.suffix(3).enumerated()), id: \.element.id) { _, msg in
                        VStack(alignment: .trailing, spacing: 2) {
                            if !msg.userText.isEmpty {
                                Text(msg.userText)
                                    .font(.system(size: 10))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.blue.opacity(0.6))
                                    .cornerRadius(8)
                            }
                            if !msg.aiText.isEmpty {
                                Text(String(msg.aiText.prefix(100)))
                                    .font(.system(size: 10))
                                    .foregroundColor(.white.opacity(0.85))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.white.opacity(0.1))
                                    .cornerRadius(8)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                        .id(msg.id)
                    }
                }
            }
            .onChange(of: messages.count) { _ in
                if let last = messages.last {
                    proxy.scrollTo(last.id, anchor: .bottom)
                }
            }
        }
        .padding(8)
        .background(Color.black.opacity(0.4))
        .background(.ultraThinMaterial.opacity(0.3))
        .cornerRadius(12)
    }
}
