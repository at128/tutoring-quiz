using Microsoft.Extensions.DependencyInjection;
using TutoringQuiz.Application.Features.Auth;

namespace TutoringQuiz.Application;

public static class DependencyInjection
{
    /// <summary>Registers every use-case handler explicitly (no scanning, no mediator).</summary>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        // Auth
        services.AddScoped<LoginHandler>();
        services.AddScoped<GetCurrentUserHandler>();

        return services;
    }
}
