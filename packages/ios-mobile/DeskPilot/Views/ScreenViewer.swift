import SwiftUI
import TXLiteAVSDK_Professional

/// Wraps a UIView for TRTC remote video rendering with pinch-to-zoom and pan
struct ScreenViewer: View {
    let pcUserId: String
    @ObservedObject var trtcService = TRTCService.shared

    @State private var scale: CGFloat = 1.0
    @State private var lastScale: CGFloat = 1.0
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if trtcService.isConnected && trtcService.screenAvailable {
                TRTCRemoteVideoView(
                    userId: trtcService.screenUserId,
                    streamType: .sub
                )
                .scaleEffect(scale)
                .offset(offset)
                .gesture(zoomGesture)
                .gesture(panGesture)
                .simultaneousGesture(doubleTapGesture)
                .ignoresSafeArea()
            } else if trtcService.isConnected {
                VStack(spacing: 12) {
                    ProgressView()
                        .scaleEffect(1.2)
                        .tint(.blue)
                    Text("Connected")
                        .foregroundColor(.blue)
                        .fontWeight(.semibold)
                    Text("Waiting for PC screen share...")
                        .foregroundColor(.gray)
                        .font(.caption)
                }
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "desktopcomputer")
                        .font(.system(size: 48))
                        .foregroundColor(.gray.opacity(0.4))
                    Text("Waiting for PC screen...")
                        .foregroundColor(.gray)
                        .font(.title3)
                    Text("Make sure DeskPilot Agent is running on your PC")
                        .foregroundColor(.gray.opacity(0.5))
                        .font(.caption)
                }
            }
        }
    }

    // Pinch to zoom
    private var zoomGesture: some Gesture {
        MagnificationGesture()
            .onChanged { value in
                let newScale = lastScale * value
                scale = min(max(newScale, 1.0), 5.0)
            }
            .onEnded { value in
                lastScale = scale
                if scale <= 1.0 {
                    withAnimation(.spring(response: 0.3)) {
                        offset = .zero
                        lastOffset = .zero
                    }
                }
            }
    }

    // Pan when zoomed in
    private var panGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                guard scale > 1.0 else { return }
                offset = CGSize(
                    width: lastOffset.width + value.translation.width,
                    height: lastOffset.height + value.translation.height
                )
            }
            .onEnded { _ in
                lastOffset = offset
            }
    }

    // Double tap to reset zoom
    private var doubleTapGesture: some Gesture {
        TapGesture(count: 2)
            .onEnded {
                withAnimation(.spring(response: 0.3)) {
                    if scale > 1.0 {
                        scale = 1.0
                        lastScale = 1.0
                        offset = .zero
                        lastOffset = .zero
                    } else {
                        scale = 2.5
                        lastScale = 2.5
                    }
                }
            }
    }
}

/// UIViewRepresentable that gives TRTC a native UIView to render into
struct TRTCRemoteVideoView: UIViewRepresentable {
    let userId: String
    let streamType: TRTCVideoStreamType

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.backgroundColor = .black
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        TRTCService.shared.startRemoteView(userId: userId, streamType: streamType, view: uiView)
    }

    static func dismantleUIView(_ uiView: UIView, coordinator: ()) {
        // Stop remote view handled by TRTCService.exitRoom()
    }
}
