using System.Globalization;
using System.Text;
using Microsoft.VisualBasic.FileIO;

namespace TutoringQuiz.Infrastructure.Seeding;

/// <summary>One data row of a CSV file, with its line number for error messages.</summary>
internal sealed record CsvRow(string File, long Line, IReadOnlyDictionary<string, string> Values)
{
    public string Text(string column)
    {
        var value = Values[column];
        return value.Length > 0 ? value : throw SeedDataException.At(File, Line, $"'{column}' is empty.");
    }

    public int Number(string column) =>
        int.TryParse(Text(column), NumberStyles.Integer, CultureInfo.InvariantCulture, out var number)
            ? number
            : throw SeedDataException.At(File, Line, $"'{column}' must be a whole number, got '{Values[column]}'.");
}

/// <summary>
/// Reads spreadsheet exports with the BCL's RFC 4180 parser (quoted fields, commas and line breaks inside quotes).
/// Accepts the UTF-8 BOM that Excel's "CSV UTF-8" export adds.
/// </summary>
internal static class CsvFile
{
    public static IReadOnlyList<CsvRow> Read(string path, params string[] expectedColumns)
    {
        var file = Path.GetFileName(path);
        if (!File.Exists(path)) throw new SeedDataException($"{file}: file not found at '{path}'.");

        using var parser = new TextFieldParser(path, Encoding.UTF8, detectEncoding: true)
        {
            TextFieldType = FieldType.Delimited,
            HasFieldsEnclosedInQuotes = true,
            TrimWhiteSpace = true,
        };
        parser.SetDelimiters(",");

        try
        {
            var header = ReadHeader(parser, file, expectedColumns);
            return ReadRows(parser, file, header).ToList();
        }
        catch (MalformedLineException ex)
        {
            throw SeedDataException.At(file, ex.LineNumber, "the line is not valid CSV (check the quotes).");
        }
    }

    private static string[] ReadHeader(TextFieldParser parser, string file, string[] expectedColumns)
    {
        var header = parser.ReadFields()?.Select(h => h.Trim('﻿', ' ').ToLowerInvariant()).ToArray()
            ?? throw SeedDataException.At(file, 1, "the file is empty.");

        var missing = expectedColumns.Except(header).ToList();
        return missing.Count == 0
            ? header
            : throw SeedDataException.At(file, 1,
                $"missing column(s) {string.Join(", ", missing)}; expected {string.Join(",", expectedColumns)}.");
    }

    private static IEnumerable<CsvRow> ReadRows(TextFieldParser parser, string file, string[] header)
    {
        while (!parser.EndOfData)
        {
            var line = parser.LineNumber;
            var fields = parser.ReadFields();
            if (fields is null || fields.All(string.IsNullOrWhiteSpace)) continue;
            if (fields.Length != header.Length)
                throw SeedDataException.At(file, line, $"expected {header.Length} values, found {fields.Length}.");

            yield return new CsvRow(file, line, header.Zip(fields).ToDictionary(p => p.First, p => p.Second.Trim()));
        }
    }
}
