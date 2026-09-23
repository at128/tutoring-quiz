using Microsoft.AspNetCore.Mvc;
using TutoringQuiz.Api.ErrorHandling;

namespace TutoringQuiz.Api;

public static class ApiSetup
{
    /// <summary>Controllers, JSON defaults and ProblemDetails for every error path.</summary>
    public static IServiceCollection AddApiEndpoints(this IServiceCollection services)
    {
        services
            .AddControllers()
            .AddJsonOptions(options => JsonDefaults.Apply(options.JsonSerializerOptions))
            .ConfigureApiBehaviorOptions(options =>
            {
                options.InvalidModelStateResponseFactory = context =>
                    new ObjectResult(ApiProblems.FromModelState(context.ModelState))
                    {
                        StatusCode = StatusCodes.Status400BadRequest,
                        ContentTypes = { "application/problem+json" },
                    };
            });

        // Required-ness is checked by the use-case validators (one place, API field names), not by MVC.
        services.Configure<MvcOptions>(options =>
            options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true);

        services.ConfigureHttpJsonOptions(options => JsonDefaults.Apply(options.SerializerOptions));
        services.AddProblemDetails();
        services.AddExceptionHandler<ProblemDetailsExceptionHandler>();
        return services;
    }
}
