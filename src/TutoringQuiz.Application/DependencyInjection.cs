using Microsoft.Extensions.DependencyInjection;
using TutoringQuiz.Application.Features.Attempts;
using TutoringQuiz.Application.Features.Auth;
using TutoringQuiz.Application.Features.StudentQuizzes;
using TutoringQuiz.Application.Features.TeacherQuizzes;
using TutoringQuiz.Application.Features.Results;

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
        services.AddScoped<StudentAttemptAccess>();
        services.AddScoped<ListStudentQuizzesHandler>();
        services.AddScoped<StartAttemptHandler>();
        services.AddScoped<GetAttemptHandler>();
        services.AddScoped<SaveAnswerHandler>();
        services.AddScoped<SubmitAttemptHandler>();
        services.AddScoped<GetAttemptResultHandler>();

        // Teacher authoring and results
        services.AddScoped<TeacherQuizAccess>();
        services.AddScoped<ListClassRoomsHandler>();
        services.AddScoped<ListTeacherQuizzesHandler>();
        services.AddScoped<GetTeacherQuizHandler>();
        services.AddScoped<CreateTeacherQuizHandler>();
        services.AddScoped<UpdateTeacherQuizHandler>();
        services.AddScoped<PublishTeacherQuizHandler>();
        services.AddScoped<UnpublishTeacherQuizHandler>();
        services.AddScoped<DeleteTeacherQuizHandler>();
        services.AddScoped<GetQuizResultsHandler>();

        return services;
    }
}
