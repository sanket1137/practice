using MediatR;

namespace CCMS.Application.Features.Auth.Commands;

public record RequestPasswordResetCommand(string Email) : IRequest<bool>;
