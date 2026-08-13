using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace CCMS.Api.Middleware;

/// <summary>
/// Global exception handler: turns unhandled exceptions into RFC 7807 ProblemDetails
/// responses without ever leaking internal exception messages, stack traces, or
/// database details to clients. Full details are logged server-side (and reach
/// Sentry via the logging pipeline when configured).
/// </summary>
public class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;
    private readonly IHostEnvironment _environment;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger, IHostEnvironment environment)
    {
        _logger = logger;
        _environment = environment;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var problemDetails = exception switch
        {
            ValidationException validationException => new ValidationProblemDetails(
                validationException.Errors
                    .GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()))
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "One or more validation errors occurred.",
                Type = "https://tools.ietf.org/html/rfc9110#section-15.5.1"
            },
            BadHttpRequestException => new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Bad request.",
                Type = "https://tools.ietf.org/html/rfc9110#section-15.5.1"
            },
            UnauthorizedAccessException => new ProblemDetails
            {
                Status = StatusCodes.Status403Forbidden,
                Title = "You do not have permission to perform this action.",
                Type = "https://tools.ietf.org/html/rfc9110#section-15.5.4"
            },
            KeyNotFoundException => new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "The requested resource was not found.",
                Type = "https://tools.ietf.org/html/rfc9110#section-15.5.5"
            },
            OperationCanceledException => new ProblemDetails
            {
                Status = 499,
                Title = "Request was cancelled."
            },
            _ => new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "An unexpected error occurred. Please try again later.",
                Type = "https://tools.ietf.org/html/rfc9110#section-15.6.1"
            }
        };

        problemDetails.Instance = httpContext.Request.Path;
        problemDetails.Extensions["traceId"] = httpContext.TraceIdentifier;

        if (problemDetails.Status >= 500)
        {
            _logger.LogError(exception,
                "Unhandled exception on {Method} {Path} (traceId {TraceId})",
                httpContext.Request.Method, httpContext.Request.Path, httpContext.TraceIdentifier);
        }
        else
        {
            _logger.LogWarning(exception,
                "Request failure {Status} on {Method} {Path} (traceId {TraceId})",
                problemDetails.Status, httpContext.Request.Method, httpContext.Request.Path, httpContext.TraceIdentifier);
        }

        // Only surface exception detail in local development.
        if (_environment.IsDevelopment())
        {
            problemDetails.Detail = exception.ToString();
        }

        httpContext.Response.StatusCode = problemDetails.Status ?? StatusCodes.Status500InternalServerError;
        await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);
        return true;
    }
}
