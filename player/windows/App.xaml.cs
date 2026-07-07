using System.Windows;

namespace PixelSpot.Player;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        var storage = new Services.SecureStorage();
        if (storage.HasDeviceToken())
        {
            var main = new MainWindow();
            main.Show();
        }
        else
        {
            // No device token — start pairing flow
            var pairing = new PairingWindow();
            pairing.Show();
        }
    }
}
