# Normalization Utils Naming Decisions

- Use `normalizeStringTo...Case` for explicit case conversions.
- Use `splitStringToWords` for generic identifier/label splitting.
- Use `normalizeStringToAsciiSlug` for storage IDs and filename fragments where
  existing alphanumeric runs such as ISO `T`/`Z` must not be split as words.
- Use `getLocalDateParts` instead of `getCurrentDateParts` because timezone semantics matter.
- Use `getTimestampForFilename` for filename-safe local or UTC timestamps.
