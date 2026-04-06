import SwiftUI

struct VoiceIndicator: View {
    @ObservedObject var trtcService = TRTCService.shared

    var body: some View {
        HStack(spacing: 14) {
            // Mic button
            Button(action: { trtcService.toggleMic() }) {
                ZStack {
                    // Pulse animation when listening
                    if trtcService.isMicOn && trtcService.botStatus == .listening {
                        Circle()
                            .fill(Color.green.opacity(0.1))
                            .frame(width: 72, height: 72)
                            .scaleEffect(1.3)
                            .opacity(0.5)
                            .animation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true), value: trtcService.botStatus)
                    }

                    Circle()
                        .fill(micBgColor)
                        .frame(width: 56, height: 56)
                        .overlay(
                            Circle()
                                .stroke(micBorderColor, lineWidth: 2)
                        )
                        .shadow(color: micBorderColor.opacity(0.3), radius: 8)

                    Image(systemName: trtcService.isMicOn ? "mic.fill" : "mic.slash.fill")
                        .font(.system(size: 22))
                        .foregroundColor(.white)
                }
            }
            .disabled(trtcService.botStatus == .thinking)

            // Status text + subtitle
            VStack(alignment: .leading, spacing: 2) {
                Text(statusText)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(micBorderColor)

                if !trtcService.botSubtitle.isEmpty {
                    Text(trtcService.botSubtitle.prefix(80))
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.6))
                        .lineLimit(2)
                }
            }

            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
        .cornerRadius(28)
        .padding(.horizontal, 12)
    }

    private var micBgColor: Color {
        if trtcService.botStatus == .thinking || trtcService.botStatus == .speaking {
            return .yellow.opacity(0.2)
        }
        return trtcService.isMicOn ? .green.opacity(0.2) : .gray.opacity(0.2)
    }

    private var micBorderColor: Color {
        if trtcService.botStatus == .thinking || trtcService.botStatus == .speaking {
            return .yellow
        }
        return trtcService.isMicOn ? .green : .gray
    }

    private var statusText: String {
        switch trtcService.botStatus {
        case .thinking: return "Processing..."
        case .speaking: return "Speaking..."
        case .listening where trtcService.isMicOn: return "Listening"
        default: return trtcService.isMicOn ? "Tap to speak" : "Mic off"
        }
    }
}
