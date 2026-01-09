using MediatR;

namespace CCMS.Application.Features.Auth.Commands;

public record ResetPasswordCommand(string Token, string NewPassword) : IRequest<bool>;
