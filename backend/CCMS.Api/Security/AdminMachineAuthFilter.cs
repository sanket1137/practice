using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace CCMS.Api.Security;

/// <summary>
/// Action filter that verifies the admin request comes from an authorized machine.
/// Reads the X-Machine-Fingerprint header and validates against AdminAuthorizedMachines.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class RequireAuthorizedMachineAttribute : TypeFilterAttribute
{
    public RequireAuthorizedMachineAttribute() : base(typeof(AdminMachineAuthFilter))
    {
    }
}

public class AdminMachineAuthFilter : IAsyncActionFilter
{
    private readonly IRepository<AdminAuthorizedMachine> _machineRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<AdminMachineAuthFilter> _logger;

    public AdminMachineAuthFilter(
        IRepository<AdminAuthorizedMachine> machineRepository,
        IUnitOfWork unitOfWork,
        ILogger<AdminMachineAuthFilter> logger)
    {
        _machineRepository = machineRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var userId = context.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var fingerprint = context.HttpContext.Request.Headers["X-Machine-Fingerprint"].FirstOrDefault();
        if (string.IsNullOrEmpty(fingerprint))
        {
            context.Result = new ObjectResult(new { message = "Machine fingerprint required for this operation" })
            {
                StatusCode = 403
            };
            return;
        }

        var fingerprintHash = HashFingerprint(fingerprint);
        var userGuid = Guid.Parse(userId);

        var machines = await _machineRepository.FindAsync(m =>
            m.AdminUserId == userGuid &&
            m.MachineFingerprintHash == fingerprintHash &&
            m.Status == AdminMachineStatus.Active);

        var machine = machines.FirstOrDefault();
        if (machine == null)
        {
            _logger.LogWarning("Unauthorized machine attempt by admin {AdminId}", userId);
            context.Result = new ObjectResult(new { message = "This machine is not authorized for payout operations" })
            {
                StatusCode = 403
            };
            return;
        }

        // Update last used timestamp
        machine.LastUsedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync();

        await next();
    }

    private static string HashFingerprint(string fingerprint)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(fingerprint));
        return Convert.ToBase64String(bytes);
    }
}
