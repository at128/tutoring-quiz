# syntax=docker/dockerfile:1

# 1) Build the React app
FROM node:24-alpine AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2) Restore and publish the API (project files first for layer caching)
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY global.json Directory.Build.props Directory.Packages.props ./
COPY src/TutoringQuiz.Domain/TutoringQuiz.Domain.csproj src/TutoringQuiz.Domain/
COPY src/TutoringQuiz.Application/TutoringQuiz.Application.csproj src/TutoringQuiz.Application/
COPY src/TutoringQuiz.Infrastructure/TutoringQuiz.Infrastructure.csproj src/TutoringQuiz.Infrastructure/
COPY src/TutoringQuiz.Api/TutoringQuiz.Api.csproj src/TutoringQuiz.Api/
RUN dotnet restore src/TutoringQuiz.Api/TutoringQuiz.Api.csproj
COPY src/ src/
RUN dotnet publish src/TutoringQuiz.Api -c Release -o /app/publish --no-restore

# 3) Runtime: one container serves the API and the SPA
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
# The SQLite volume is mounted here; it must belong to the non-root app user before we switch to it.
RUN mkdir -p /app/data && chown -R $APP_UID /app/data
COPY --from=build /app/publish ./
COPY --from=web /src/frontend/dist ./wwwroot
COPY seed/ ./seed/
ENV ASPNETCORE_URLS=http://+:8080 \
    ConnectionStrings__Default="Data Source=/app/data/tutoringquiz.db" \
    Seed__Enabled=true \
    Seed__Path=/app/seed
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "TutoringQuiz.Api.dll"]
