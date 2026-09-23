using Microsoft.Extensions.DependencyInjection;
using TutoringQuiz.Application.Features.Attempts;
using TutoringQuiz.Application.Features.Auth;
using TutoringQuiz.Application.Features.StudentQuizzes;

namespace TutoringQuiz.Application;

public static class DependencyInjection
{
    /// <summary>Registers every use-case handler explicitly (no scanning, no mediator).</summary>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        // Auth
        services.AddScoped<LoginHandler>();
        services.AddScoped<GetCurrentUserHandler>();

        // Student
        services.AddScoped<AttemptFinalizer>();
        services.AddScoped<ListStudentQuizzesHandler>();

        return services;
    }
}
