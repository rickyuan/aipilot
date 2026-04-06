import SwiftUI

struct HomeScreen: View {
    @State private var pairingCode = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var pairingResult: PairingResponse?
    @State private var navigateToRemote = false
    @State private var pairedDevice: PairedDevice? = PairedDeviceStore.load()
    @State private var showPairingInput = false
    @FocusState private var isCodeFocused: Bool

    var body: some View {
        ZStack {
            Color(.systemGroupedBackground).ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    Spacer().frame(height: 80)

                    // App icon
                    Image(systemName: "laptopcomputer.and.iphone")
                        .font(.system(size: 52, weight: .thin))
                        .foregroundStyle(.tint)
                        .padding(.bottom, 16)

                    Text("DeskPilot")
                        .font(.largeTitle.bold())

                    Text("Voice-control your PC remotely")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .padding(.bottom, 40)

                    if let device = pairedDevice, !showPairingInput {
                        // Paired device — one-tap reconnect
                        pairedDeviceCard(device)
                    } else {
                        // New pairing
                        pairingCard
                    }

                    // Error
                    if let error = errorMessage {
                        Label(error, systemImage: "exclamationmark.triangle")
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .padding(.top, 12)
                    }

                    Spacer().frame(height: 40)
                }
            }
        }
        .onTapGesture { isCodeFocused = false }
        .navigationDestination(isPresented: $navigateToRemote) {
            if let result = pairingResult {
                RemoteScreen(
                    roomId: result.roomId,
                    pcUserId: result.pcUserId,
                    roomConfig: result.mobileRoomConfig
                )
            }
        }
    }

    // MARK: - Paired Device Card

    private func pairedDeviceCard(_ device: PairedDevice) -> some View {
        VStack(spacing: 0) {
            VStack(spacing: 16) {
                HStack(spacing: 12) {
                    Image(systemName: "desktopcomputer")
                        .font(.system(size: 28))
                        .foregroundStyle(.tint)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(device.displayName)
                            .font(.headline)
                        Text("Paired")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Circle()
                        .fill(.green)
                        .frame(width: 8, height: 8)
                }
            }
            .padding(20)

            Divider()

            // Connect button
            Button(action: { reconnect(device) }) {
                HStack {
                    if isLoading {
                        ProgressView().controlSize(.small)
                    } else {
                        Image(systemName: "play.fill")
                        Text("Connect")
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .fontWeight(.medium)
            }
            .disabled(isLoading)
            .padding(.horizontal, 20)
            .padding(.vertical, 8)

            Divider()

            // Pair new device / Forget
            HStack {
                Button("Pair New PC") {
                    showPairingInput = true
                }
                .font(.footnote)

                Spacer()

                Button("Forget") {
                    PairedDeviceStore.clear()
                    pairedDevice = nil
                }
                .font(.footnote)
                .foregroundStyle(.red)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
        }
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(16)
        .padding(.horizontal, 20)
    }

    // MARK: - Pairing Input Card

    private var pairingCard: some View {
        VStack(spacing: 0) {
            VStack(spacing: 20) {
                VStack(spacing: 4) {
                    Text("Pairing Code")
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    // Hidden TextField
                    TextField("", text: $pairingCode)
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
                        .focused($isCodeFocused)
                        .frame(width: 1, height: 1)
                        .opacity(0.01)
                        .toolbar {
                            ToolbarItemGroup(placement: .keyboard) {
                                Spacer()
                                Button("Done") { isCodeFocused = false }
                                    .fontWeight(.medium)
                            }
                        }
                        .onChange(of: pairingCode) { newValue in
                            let filtered = newValue.filter { $0.isNumber }
                            pairingCode = String(filtered.prefix(6))
                            if pairingCode.count == 6 { isCodeFocused = false }
                        }

                    // Digit boxes
                    HStack(spacing: 8) {
                        ForEach(0..<6, id: \.self) { index in
                            let digit = index < pairingCode.count
                                ? String(pairingCode[pairingCode.index(pairingCode.startIndex, offsetBy: index)])
                                : ""
                            Text(digit)
                                .font(.system(size: 24, weight: .semibold, design: .rounded))
                                .frame(maxWidth: .infinity)
                                .frame(height: 52)
                                .background(Color(.tertiarySystemGroupedBackground))
                                .cornerRadius(10)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(
                                            index == pairingCode.count && isCodeFocused
                                                ? Color.accentColor : Color(.separator),
                                            lineWidth: index == pairingCode.count && isCodeFocused ? 2 : 0.5
                                        )
                                )
                        }
                    }
                    .onTapGesture { isCodeFocused = true }

                    Text("Enter the code shown on your PC")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 4)
                }
            }
            .padding(20)

            Divider()

            Button(action: pairAndConnect) {
                HStack {
                    if isLoading {
                        ProgressView().controlSize(.small)
                    } else {
                        Text("Connect")
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .fontWeight(.medium)
            }
            .disabled(pairingCode.count != 6 || isLoading)
            .padding(.horizontal, 20)
            .padding(.vertical, 8)

            if pairedDevice != nil {
                Divider()
                Button("Cancel") {
                    showPairingInput = false
                    pairingCode = ""
                }
                .font(.footnote)
                .padding(.vertical, 10)
            }
        }
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(16)
        .padding(.horizontal, 20)
    }

    // MARK: - Actions

    private func pairAndConnect() {
        guard pairingCode.count == 6 else { return }
        isLoading = true
        errorMessage = nil
        let mobileUserId = PairedDeviceStore.mobileUserId

        Task {
            do {
                let result = try await APIClient.verifyPairingCode(
                    code: pairingCode, mobileUserId: mobileUserId
                )
                // Save paired device
                let device = PairedDevice(
                    pcId: result.pcUserId,
                    pairingCode: pairingCode,
                    roomId: result.roomId,
                    displayName: result.pcUserId,
                    pairedAt: Date(),
                    roomConfig: result.mobileRoomConfig
                )
                PairedDeviceStore.save(device)

                await MainActor.run {
                    pairedDevice = device
                    showPairingInput = false
                    pairingResult = result
                    isLoading = false
                    navigateToRemote = true
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }

    private func reconnect(_ device: PairedDevice) {
        isLoading = true
        errorMessage = nil
        let mobileUserId = PairedDeviceStore.mobileUserId

        Task {
            do {
                // Re-verify with the stored fixed code
                let result = try await APIClient.verifyPairingCode(
                    code: device.pairingCode, mobileUserId: mobileUserId
                )
                await MainActor.run {
                    pairingResult = result
                    isLoading = false
                    navigateToRemote = true
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
}
