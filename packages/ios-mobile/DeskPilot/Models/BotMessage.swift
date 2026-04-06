import Foundation

/// TRTC custom message envelope
struct CustomMessage: Codable {
    let type: Int
    let payload: [String: AnyCodable]
}

/// Bot subtitle (type 10000)
struct BotSubtitle {
    let text: String
    let end: Bool
    let roundId: String
}

/// Bot status (type 10001): 1=listening, 2=thinking, 3=speaking, 4=interrupted
struct BotStatusMessage {
    let state: Int
    let roundId: String
}

/// User subtitle / ASR result (type 10002)
struct UserSubtitle {
    let text: String
    let end: Bool
    let roundId: String
}

enum BotStatus: String {
    case idle
    case listening
    case thinking
    case speaking
    case interrupted

    static func from(state: Int) -> BotStatus {
        switch state {
        case 1: return .listening
        case 2: return .thinking
        case 3: return .speaking
        case 4: return .interrupted
        default: return .idle
        }
    }

    var displayText: String {
        switch self {
        case .idle: return ""
        case .listening: return "Listening..."
        case .thinking: return "Thinking..."
        case .speaking: return "Speaking..."
        case .interrupted: return "Interrupted"
        }
    }
}

/// Type-erased Codable wrapper for JSON dictionaries
struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let intVal = try? container.decode(Int.self) {
            value = intVal
        } else if let doubleVal = try? container.decode(Double.self) {
            value = doubleVal
        } else if let boolVal = try? container.decode(Bool.self) {
            value = boolVal
        } else if let stringVal = try? container.decode(String.self) {
            value = stringVal
        } else {
            value = ""
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let intVal = value as? Int {
            try container.encode(intVal)
        } else if let doubleVal = value as? Double {
            try container.encode(doubleVal)
        } else if let boolVal = value as? Bool {
            try container.encode(boolVal)
        } else if let stringVal = value as? String {
            try container.encode(stringVal)
        }
    }

    var stringValue: String {
        if let s = value as? String { return s }
        if let i = value as? Int { return String(i) }
        if let d = value as? Double { return String(d) }
        return ""
    }

    var intValue: Int {
        if let i = value as? Int { return i }
        if let d = value as? Double { return Int(d) }
        return 0
    }

    var boolValue: Bool {
        if let b = value as? Bool { return b }
        if let i = value as? Int { return i != 0 }
        return false
    }
}
