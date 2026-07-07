using System.Runtime.InteropServices;
using System.Timers;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media.Imaging;
using PixelSpot.Player.Services;

namespace PixelSpot.Player;

public partial class MainWindow : Window
{
    // Low-level keyboard hook for kiosk mode
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;
    private LowLevelKeyboardProc? _keyboardProc;
    private nint _keyboardHookId = nint.Zero;

    private delegate nint LowLevelKeyboardProc(int nCode, nint wParam, nint lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern nint SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, nint hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(nint hhk);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern nint CallNextHookEx(nint hhk, int nCode, nint wParam, nint lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern nint GetModuleHandle(string lpModuleName);

    private readonly PlaylistEngine _playlist;
    private readonly PlayerService _playerService;
    private readonly ContentDownloader _downloader;
    private readonly SecureStorage _storage;
    private CancellationTokenSource _cts = new();

    public MainWindow()
    {
        InitializeComponent();
        _storage = new SecureStorage();
        _downloader = new ContentDownloader();
        _playlist = new PlaylistEngine(_downloader);
        _playerService = new PlayerService(new ApiClient(), _storage, _playlist, _downloader);

        Loaded += OnWindowLoaded;
        Closing += OnWindowClosing;

        // Block closing via Alt+F4
        Closing += (_, e) => e.Cancel = !_storage.IsUnpaired();
    }

    private async void OnWindowLoaded(object sender, RoutedEventArgs e)
    {
        InstallKeyboardHook();
        ShowStatus("Syncing content...");
        SyncOverlay.Visibility = Visibility.Visible;

        await _playerService.StartAsync(_cts.Token);

        SyncOverlay.Visibility = Visibility.Collapsed;
        PlayNext();

        // Wire up remote command handler
        _playerService.OnCommand += HandleRemoteCommand;
        _playerService.OnPlaylistUpdated += async () =>
        {
            await Dispatcher.InvokeAsync(PlayNext);
        };
    }

    private void PlayNext()
    {
        var item = _playlist.GetNext();
        if (item == null) return;

        if (item.IsVideo)
        {
            ImageDisplay.Visibility = Visibility.Collapsed;
            VideoPlayer.Visibility = Visibility.Visible;
            VideoPlayer.Source = new Uri(item.LocalPath);
            VideoPlayer.Play();
        }
        else
        {
            VideoPlayer.Stop();
            VideoPlayer.Visibility = Visibility.Collapsed;
            var bmp = new BitmapImage(new Uri(item.LocalPath));
            ImageDisplay.Source = bmp;
            ImageDisplay.Visibility = Visibility.Visible;

            // Auto-advance images after display duration
            var timer = new System.Timers.Timer(item.DurationSeconds * 1000);
            timer.Elapsed += (_, _) => { timer.Stop(); Dispatcher.Invoke(PlayNext); };
            timer.AutoReset = false;
            timer.Start();
        }
    }

    private void OnMediaEnded(object sender, RoutedEventArgs e) => PlayNext();

    private void OnMediaFailed(object sender, ExceptionRoutedEventArgs e)
    {
        ShowStatus($"Playback error: {e.ErrorException?.Message}");
        PlayNext();
    }

    private void HandleRemoteCommand(string command, object? payload)
    {
        Dispatcher.Invoke(() =>
        {
            switch (command.ToLowerInvariant())
            {
                case "play":
                    VideoPlayer.Play();
                    ShowStatus("Playing");
                    break;
                case "pause":
                    VideoPlayer.Pause();
                    ShowStatus("Paused");
                    break;
                case "skip":
                    VideoPlayer.Stop();
                    PlayNext();
                    ShowStatus("Skipped");
                    break;
                case "volume":
                    if (payload is double vol)
                        VideoPlayer.Volume = Math.Clamp(vol, 0, 1);
                    break;
                case "brightness":
                    // WPF doesn't have direct brightness control — adjust Opacity of overlay
                    if (payload is double brightness)
                    {
                        var overlay = FindName("BrightnessOverlay") as System.Windows.Shapes.Rectangle;
                        if (overlay != null)
                            overlay.Opacity = 1.0 - Math.Clamp(brightness, 0, 1);
                    }
                    break;
                case "restart":
                    _playerService.RequestSync();
                    break;
                case "unpair":
                    _storage.ClearDeviceToken();
                    Application.Current.Dispatcher.Invoke(() =>
                    {
                        var pairing = new PairingWindow();
                        pairing.Show();
                        Close();
                    });
                    break;
            }
        });
    }

    private void ShowStatus(string message)
    {
        Dispatcher.Invoke(() =>
        {
            StatusText.Text = message;
            StatusOverlay.Visibility = Visibility.Visible;
            var timer = new System.Timers.Timer(3000);
            timer.Elapsed += (_, _) =>
            {
                timer.Stop();
                Dispatcher.Invoke(() => StatusOverlay.Visibility = Visibility.Collapsed);
            };
            timer.AutoReset = false;
            timer.Start();
        });
    }

    // ─── Kiosk mode keyboard hook ─────────────────────────────────────────────

    private void InstallKeyboardHook()
    {
        _keyboardProc = KeyboardHookCallback;
        using var curProcess = System.Diagnostics.Process.GetCurrentProcess();
        using var curModule = curProcess.MainModule!;
        _keyboardHookId = SetWindowsHookEx(WH_KEYBOARD_LL, _keyboardProc,
            GetModuleHandle(curModule.ModuleName!), 0);
    }

    private nint KeyboardHookCallback(int nCode, nint wParam, nint lParam)
    {
        if (nCode >= 0 && wParam == WM_KEYDOWN)
        {
            int vkCode = Marshal.ReadInt32(lParam);
            var key = KeyInterop.KeyFromVirtualKey(vkCode);

            // Block: Win key, F4 (Alt+F4), F1, Escape, Tab, PrintScreen
            if (key is Key.LWin or Key.RWin or Key.F4 or Key.F1
                     or Key.Escape or Key.PrintScreen or Key.Tab)
            {
                return 1; // Block the key
            }
        }
        return CallNextHookEx(_keyboardHookId, nCode, wParam, lParam);
    }

    private void OnWindowClosing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        if (_keyboardHookId != nint.Zero)
            UnhookWindowsHookEx(_keyboardHookId);

        _cts.Cancel();
        _playerService.Dispose();
    }
}
