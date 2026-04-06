import SwiftUI

struct ConversationView: View {
    let messages: [ConversationMessage]

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 6) {
                    ForEach(Array(messages.enumerated()), id: \.element.id) { _, msg in
                        VStack(spacing: 4) {
                            if !msg.userText.isEmpty {
                                HStack {
                                    Spacer(minLength: 60)
                                    Text(msg.userText)
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 8)
                                        .background(Color.blue.opacity(0.85))
                                        .foregroundColor(.white)
                                        .clipShape(RoundedRectangle(cornerRadius: 16))
                                        .font(.system(size: 14))
                                }
                            }

                            if !msg.aiText.isEmpty {
                                HStack {
                                    Text(msg.aiText)
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 8)
                                        .background(Color.white.opacity(0.12))
                                        .foregroundColor(.white.opacity(0.95))
                                        .clipShape(RoundedRectangle(cornerRadius: 16))
                                        .font(.system(size: 14))
                                    Spacer(minLength: 60)
                                }
                            }
                        }
                        .padding(.horizontal, 12)
                        .id(msg.id)
                    }
                }
                .padding(.vertical, 8)
            }
            .onChange(of: messages.count) { _ in
                if let last = messages.last {
                    withAnimation(.easeOut(duration: 0.2)) {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
        }
    }
}
