import Foundation

struct ConversationMessage: Identifiable {
    let id: String  // roundId
    var userText: String
    var aiText: String
    var timestamp: Date
    var isCompleted: Bool

    init(roundId: String, userText: String = "", aiText: String = "") {
        self.id = roundId
        self.userText = userText
        self.aiText = aiText
        self.timestamp = Date()
        self.isCompleted = false
    }
}
