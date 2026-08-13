import SwiftUI

struct PairingView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var viewModel = PairingViewModel()

    var body: some View {
        ZStack {
            Color(red: 0.059, green: 0.090, blue: 0.165).ignoresSafeArea()

            VStack(spacing: 32) {
                // Logo / title
                VStack(spacing: 8) {
                    Image(systemName: "tv.fill")
                        .font(.system(size: 60))
                        .foregroundColor(Color(red: 0.388, green: 0.400, blue: 0.945))
                    Text("PixelSpot Player")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(.white)
                }

                if let code = viewModel.pairingCode {
                    // QR Code
                    VStack(spacing: 12) {
                        if let qrImage = viewModel.qrImage {
                            Image(uiImage: qrImage)
                                .interpolation(.none)
                                .resizable()
                                .frame(width: 200, height: 200)
                                .padding(16)
                                .background(Color.white)
                                .cornerRadius(12)
                        }

                        Text("Or enter code manually:")
                            .foregroundColor(Color(red: 0.580, green: 0.643, blue: 0.729))
                        Text(code)
                            .font(.system(size: 36, weight: .bold, design: .monospaced))
                            .foregroundColor(.white)
                            .tracking(8)
                    }

                    Text("Scan the QR code or enter the code at ccms.pixelspot.in")
                        .font(.caption)
                        .foregroundColor(Color(red: 0.580, green: 0.643, blue: 0.729))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)

                } else if viewModel.isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(2)
                } else if let error = viewModel.errorMessage {
                    Text(error)
                        .foregroundColor(.red)
                    Button("Retry") { Task { await viewModel.startPairing() } }
                        .buttonStyle(.borderedProminent)
                }

                // Manual code entry
                VStack(spacing: 8) {
                    TextField("Enter pairing code", text: $viewModel.manualCode)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.characters)
                        .frame(maxWidth: 200)
                    Button("Pair Manually") {
                        Task { await viewModel.pairManually(appState: appState) }
                    }
                    .disabled(viewModel.manualCode.count < 6)
                    .buttonStyle(.borderedProminent)
                    .tint(Color(red: 0.388, green: 0.400, blue: 0.945))
                }
            }
            .padding(40)
        }
        .task { await viewModel.startPairing() }
    }
}
