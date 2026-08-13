using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace PixelSpot.Player.Services;

/// <summary>
/// Stores device credentials using Windows DPAPI (machine-scope encryption).
/// No plaintext secrets ever touch disk.
/// </summary>
public class SecureStorage
{
    private static readonly string StoragePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "PixelSpot", "Player", "device.dat"
    );

    private bool _unpaired = false;

    public bool HasDeviceToken()
    {
        if (!File.Exists(StoragePath)) return false;
        try
        {
            var token = GetDeviceToken();
            return !string.IsNullOrWhiteSpace(token);
        }
        catch
        {
            return false;
        }
    }

    public void StoreDeviceToken(string token)
    {
        var directory = Path.GetDirectoryName(StoragePath)!;
        Directory.CreateDirectory(directory);

        var plainBytes = Encoding.UTF8.GetBytes(token);
        var encrypted = ProtectedData.Protect(plainBytes, null, DataProtectionScope.LocalMachine);
        File.WriteAllBytes(StoragePath, encrypted);
    }

    public string GetDeviceToken()
    {
        if (!File.Exists(StoragePath))
            throw new InvalidOperationException("Device not paired. No token stored.");

        var encrypted = File.ReadAllBytes(StoragePath);
        var plainBytes = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.LocalMachine);
        return Encoding.UTF8.GetString(plainBytes);
    }

    public void ClearDeviceToken()
    {
        _unpaired = true;
        if (File.Exists(StoragePath))
            File.Delete(StoragePath);
    }

    /// <summary>Returns true if the device was explicitly unpaired (allows window close).</summary>
    public bool IsUnpaired() => _unpaired;
}
