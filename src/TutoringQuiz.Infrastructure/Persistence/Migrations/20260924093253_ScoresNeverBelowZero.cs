using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TutoringQuiz.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Data only: a total score never goes below 0 (Atta, 24 Sep), so attempts finalized under the old rule are
    /// brought to it. SQLite stores decimals as text, hence the cast.
    /// </summary>
    public partial class ScoresNeverBelowZero : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """UPDATE "QuizAttempts" SET "Score" = '0.0' WHERE "Score" IS NOT NULL AND CAST("Score" AS REAL) < 0;""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The negative totals aren't kept, so there is nothing to restore.
        }
    }
}
