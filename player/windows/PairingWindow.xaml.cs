using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Timers;
using System.Windows;
using System.Windows.Media.Imaging;
using PixelSpot.Player.Services;
using QRCoder;

namespace PixelSpot.Player;

public partial class PairingWindow : Window
{
    private readonly ApiClient _api;
    private readonly SecureStorage _storage;
    private System.Timers.Timer? _pollTimer;
    private string _pairingCode = string.Empty;

    public PairingWindow()
    {
        InitializeComponent();
        _api = new ApiClient();
        _storage = new SecureStorage();
        Loaded += async (_, _) => await InitializePairing();
    }

    private async Task InitializePairing()
    {
        try
        {
            var result = await _api.RequestPairingCodeAsync();
            _pairingCode = result.Code;

            Dispatcher.Invoke(() =>
            {
                PairingCodeLabel.Text = _pairingCode;
                RenderQrCode(result.QrCodeUrl ?? $"pixelspot://pair/{_pairingCode}");
                StatusLabel.Text = "Waiting for admin to approve this device...";
            });

            StartPolling();
        }
        catch (Exception ex)
        {
            Dispatcher.Invoke(() =>
            {
                ErrorLabel.Text = $"Failed to get pairing code: {ex.Message}";
                ErrorLabel.Visibility = Visibility.Visible;
                StatusLabel.Text = "Please use manual code entry above.";
            });
        }
    }

    private void RenderQrCode(string content)
    {
        using var qrGenerator = new QRCodeGenerator();
        var qrData = qrGenerator.CreateQrCode(content, QRCodeGenerator.ECCLevel.Q);
        using var qrCode = new PngByteQRCode(qrData);
        var pngBytes = qrCode.GetGraphic(10);

        using var ms = new System.IO.MemoryStream(pngBytes);
        var bitmapImage = new BitmapImage();
        bitmapImage.BeginInit();
        bitmapImage.StreamSource = ms;
        bitmapImage.CacheOption = BitmapCacheOption.OnLoad;
        bitmapImage.EndInit();
        bitmapImage.Freeze();

        QrImage.Source = bitmapImage;
    }

    private void StartPolling()
    {
        _pollTimer = new System.Timers.Timer(5000);
        _pollTimer.Elapsed += async (_, _) => await PollPairingStatus();
        _pollTimer.AutoReset = true;
        _pollTimer.Start();
    }

    private async Task PollPairingStatus()
    {
        try
        {
            var status = await _api.GetPairingStatusAsync(_pairingCode);
            if (status.IsApproved)
            {
                _pollTimer?.Stop();
                _storage.StoreDeviceToken(status.DeviceToken!);

                Dispatcher.Invoke(() =>
                {
                    StatusLabel.Text = "Pairing successful! Launching player...";
                    var main = new MainWindow();
                    main.Show();
                    Close();
                });
            }
        }
        catch
        {
            // Silently retry — network may be temporarily unavailable
        }
    }

    private async void OnManualPairClick(object sender, RoutedEventArgs e)
    {
        var code = ManualCodeBox.Text.Trim().ToUpper();
        if (code.Length != 6)
        {
            ErrorLabel.Text = "Please enter exactly 6 characters.";
            ErrorLabel.Visibility = Visibility.Visible;
            return;
        }

        try
        {
            ErrorLabel.Visibility = Visibility.Collapsed;
            StatusLabel.Text = "Pairing...";

            var result = await _api.ClaimPairingCodeAsync(code);
            _storage.StoreDeviceToken(result.DeviceToken);

            var main = new MainWindow();
            main.Show();
            Close();
        }
        catch (Exception ex)
        {
            ErrorLabel.Text = $"Pairing failed: {ex.Message}";
            ErrorLabel.Visibility = Visibility.Visible;
            StatusLabel.Text = "Please check the code and try again.";
        }
    }

    protected override void OnClosed(EventArgs e)
    {
        _pollTimer?.Stop();
        _pollTimer?.Dispose();
        base.OnClosed(e);
    }
}
