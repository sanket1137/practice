using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using CCMS.Domain.Enums;
using CCMS.Infrastructure.Data;

namespace CCMS.Api.Security;

[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public class RequiresCmsPlanAttribute : Attribute, IAsyncActionFilter
{
    private readonly CmsPlanTier _minimumPlan;
    private readonly string? _feature;

    public RequiresCmsPlanAttribute(CmsPlanTier minimumPlan, string? feature = null)
    {
        _minimumPlan = minimumPlan;
        _feature = feature;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var userIdClaim = context.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? context.HttpContext.User.FindFirstValue("sub");

        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var dbContext = context.HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();
        var userPlan = await dbContext.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.CmsPlan)
            .FirstOrDefaultAsync();

        if ((int)userPlan < (int)_minimumPlan)
        {
            context.Result = new ObjectResult(new
            {
                error = $"This feature requires {_minimumPlan} plan or higher.",
                requiredPlan = _minimumPlan.ToString(),
                currentPlan = userPlan.ToString(),
                upgradeUrl = "/cms/billing",
                feature = _feature
            })
            {
                StatusCode = StatusCodes.Status402PaymentRequired
            };
            return;
        }

        await next();
    }
}
