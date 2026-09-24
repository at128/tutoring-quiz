using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TutoringQuiz.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// A fixed deduction per wrong answer, removal marks that keep answered questions and options readable after a closed
    /// quiz is corrected, the regrade time, and whether students see their score (on for existing quizzes).
    /// </summary>
    public partial class ClosedQuizEditingAndScoreVisibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Quizzes saved before this setting existed keep showing scores to students.
            migrationBuilder.AddColumn<bool>(
                name: "ScoresVisibleToStudents",
                table: "Quizzes",
                type: "INTEGER",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<decimal>(
                name: "WrongAnswerPenaltyPoints",
                table: "Quizzes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RegradedAtUtc",
                table: "QuizAttempts",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RemovedAtUtc",
                table: "Questions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RemovedAtUtc",
                table: "Options",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ScoresVisibleToStudents",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "WrongAnswerPenaltyPoints",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "RegradedAtUtc",
                table: "QuizAttempts");

            migrationBuilder.DropColumn(
                name: "RemovedAtUtc",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "RemovedAtUtc",
                table: "Options");
        }
    }
}
