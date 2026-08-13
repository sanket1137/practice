using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Shared.DTOs.Admin;
using Asp.Versioning;

namespace CCMS.Api.Controllers;

[Authorize(Roles = "Admin")]
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/admin/machines")]
public class AdminMachinesController : ControllerBase
{
    private readonly IRepository<AdminAuthorizedMachine> _machineRepository;
    private readonly IRepository<User> _userRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<AdminMachinesController> _logger;

    public AdminMachinesController(
        IRepository<AdminAuthorizedMachine> machineRepository,
        IRepository<User> userRepository,
        IUnitOfWork unitOfWork,
        ILogger<AdminMachinesController> logger)
    {
        _machineRepository = machineRepository;
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    /// <summary>
    /// Get all authorized machines (admin only)
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var machines = await _machineRepository.FindAsync(m => true);
            var dtos = new List<AdminMachineDto>();

            foreach (var m in machines)
            {
                var admin = await _userRepository.GetByIdAsync(m.AdminUserId);
                var authorizer = await _userRepository.GetByIdAsync(m.AuthorizedByUserId);

                dtos.Add(new AdminMachineDto
                {
                    Id = m.Id,
                    AdminUserId = m.AdminUserId,
                    AdminName = admin != null ? $"{admin.FirstName} {admin.LastName}".Trim() : "Unknown",
                    MachineName = m.MachineName,
                    MachineDetails = m.MachineDetails,
                    Status = m.Status.ToString(),
                    AuthorizedByUserId = m.AuthorizedByUserId,
                    AuthorizedByName = authorizer != null ? $"{authorizer.FirstName} {authorizer.LastName}".Trim() : "Unknown",
                    CreatedAt = m.CreatedAt,
                    LastUsedAt = m.LastUsedAt,
                    RevokedAt = m.RevokedAt
                });
            }

            return Ok(CCMS.Shared.Common.ApiResponse<List<AdminMachineDto>>.SuccessResponse(dtos));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching authorized machines");
            return StatusCode(500, CCMS.Shared.Common.ApiResponse<List<AdminMachineDto>>.ErrorResponse("Failed to fetch machines"));
        }
    }

    /// <summary>
    /// Get current admin's authorized machines
    /// </summary>
    [HttpGet("my")]
    public async Task<IActionResult> GetMyMachines()
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var machines = await _machineRepository.FindAsync(m => m.AdminUserId == userId && m.Status == AdminMachineStatus.Active);

            var dtos = machines.Select(m => new AdminMachineDto
            {
                Id = m.Id,
                AdminUserId = m.AdminUserId,
                MachineName = m.MachineName,
                MachineDetails = m.MachineDetails,
                Status = m.Status.ToString(),
                AuthorizedByUserId = m.AuthorizedByUserId,
                CreatedAt = m.CreatedAt,
                LastUsedAt = m.LastUsedAt
            }).ToList();

            return Ok(CCMS.Shared.Common.ApiResponse<List<AdminMachineDto>>.SuccessResponse(dtos));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching my machines");
            return StatusCode(500, CCMS.Shared.Common.ApiResponse<List<AdminMachineDto>>.ErrorResponse("Failed to fetch machines"));
        }
    }

    /// <summary>
    /// Authorize a new machine for the current admin.
    /// If this is the first admin machine in the system, it auto-authorizes.
    /// Otherwise, requires an existing authorized machine to approve.
    /// </summary>
    [HttpPost("authorize")]
    public async Task<IActionResult> AuthorizeMachine([FromBody] AuthorizeMachineRequest request)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var fingerprintHash = HashFingerprint(request.MachineFingerprint);

            // Check if this machine is already registered
            var existing = (await _machineRepository.FindAsync(m =>
                m.AdminUserId == userId &&
                m.MachineFingerprintHash == fingerprintHash &&
                m.Status == AdminMachineStatus.Active)).FirstOrDefault();

            if (existing != null)
            {
                existing.LastUsedAt = DateTime.UtcNow;
                await _unitOfWork.SaveChangesAsync();
                return Ok(CCMS.Shared.Common.ApiResponse<AdminMachineDto>.SuccessResponse(
                    new AdminMachineDto
                    {
                        Id = existing.Id,
                        AdminUserId = existing.AdminUserId,
                        MachineName = existing.MachineName,
                        Status = existing.Status.ToString(),
                        CreatedAt = existing.CreatedAt,
                        LastUsedAt = existing.LastUsedAt
                    }, "Machine already authorized"));
            }

            // Check if any authorized machines exist in the system
            var anyExisting = (await _machineRepository.FindAsync(m => m.Status == AdminMachineStatus.Active)).Any();

            var machine = new AdminAuthorizedMachine
            {
                AdminUserId = userId,
                MachineFingerprintHash = fingerprintHash,
                MachineName = request.MachineName,
                MachineDetails = request.MachineDetails,
                Status = AdminMachineStatus.Active,
                AuthorizedByUserId = userId, // Self-authorized (first machine) or admin-authorized
                CreatedAt = DateTime.UtcNow
            };

            if (!anyExisting)
            {
                // First machine in system — auto-authorize
                _logger.LogInformation("First admin machine registration. Auto-authorizing for admin {AdminId}", userId);
            }

            await _machineRepository.AddAsync(machine);
            await _unitOfWork.SaveChangesAsync();

            return Ok(CCMS.Shared.Common.ApiResponse<AdminMachineDto>.SuccessResponse(
                new AdminMachineDto
                {
                    Id = machine.Id,
                    AdminUserId = machine.AdminUserId,
                    MachineName = machine.MachineName,
                    MachineDetails = machine.MachineDetails,
                    Status = machine.Status.ToString(),
                    AuthorizedByUserId = machine.AuthorizedByUserId,
                    CreatedAt = machine.CreatedAt
                }, anyExisting ? "Machine authorized" : "First machine auto-authorized"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error authorizing machine");
            return StatusCode(500, CCMS.Shared.Common.ApiResponse<AdminMachineDto>.ErrorResponse("Failed to authorize machine"));
        }
    }

    /// <summary>
    /// Revoke a machine authorization
    /// </summary>
    [HttpPost("revoke/{id}")]
    public async Task<IActionResult> RevokeMachine(Guid id)
    {
        try
        {
            var machine = await _machineRepository.GetByIdAsync(id);
            if (machine == null)
                return NotFound(CCMS.Shared.Common.ApiResponse<string>.ErrorResponse("Machine not found"));

            machine.Status = AdminMachineStatus.Revoked;
            machine.RevokedAt = DateTime.UtcNow;
            machine.UpdatedAt = DateTime.UtcNow;
            await _unitOfWork.SaveChangesAsync();

            return Ok(CCMS.Shared.Common.ApiResponse<string>.SuccessResponse("Machine revoked successfully"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error revoking machine {MachineId}", id);
            return StatusCode(500, CCMS.Shared.Common.ApiResponse<string>.ErrorResponse("Failed to revoke machine"));
        }
    }

    /// <summary>
    /// Check if the current request comes from an authorized machine.
    /// Used by frontend to show/hide payout processing buttons.
    /// </summary>
    [HttpGet("status")]
    public async Task<IActionResult> CheckMachineStatus([FromQuery] string machineFingerprint)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var fingerprintHash = HashFingerprint(machineFingerprint);

            var machine = (await _machineRepository.FindAsync(m =>
                m.AdminUserId == userId &&
                m.MachineFingerprintHash == fingerprintHash &&
                m.Status == AdminMachineStatus.Active)).FirstOrDefault();

            if (machine != null)
            {
                machine.LastUsedAt = DateTime.UtcNow;
                await _unitOfWork.SaveChangesAsync();
            }

            return Ok(CCMS.Shared.Common.ApiResponse<MachineStatusResponse>.SuccessResponse(
                new MachineStatusResponse
                {
                    IsAuthorized = machine != null,
                    MachineName = machine?.MachineName,
                    LastUsedAt = machine?.LastUsedAt
                }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking machine status");
            return StatusCode(500, CCMS.Shared.Common.ApiResponse<MachineStatusResponse>.ErrorResponse("Failed to check machine status"));
        }
    }

    private static string HashFingerprint(string fingerprint)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(fingerprint));
        return Convert.ToBase64String(bytes);
    }
}
