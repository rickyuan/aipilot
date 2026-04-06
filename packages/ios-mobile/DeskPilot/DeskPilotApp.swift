import SwiftUI

@main
struct DeskPilotApp: App {
    var body: some Scene {
        WindowGroup {
            NavigationStack {
                HomeScreen()
            }
            .preferredColorScheme(.dark)
        }
    }
}
