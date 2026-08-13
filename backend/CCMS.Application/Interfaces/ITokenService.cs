namespace CCMS.Application.Interfaces;

public interface ITokenService
{
    string GenerateAccessToken(Guid userId, string email, string role, string? accountType = null);
    string GenerateRefreshToken();
    bool ValidateToken(string token);
    Guid? GetUserIdFromToken(string token);
}
