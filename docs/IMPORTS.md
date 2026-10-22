# Academic data imports

Only authenticated administrators can import or edit academic data. Download the fictional JSON example from the admin screen. Importing always creates a new draft version; it never partially overwrites a live version. Use a unique slug. Inspect the document, save/validate it and publish explicitly. Published documents must be fictional or verified, and are immutable.

## JSON document

Top-level fields: `slug`, `university`, `program`, `version`, nullable `admissionYear`, `campuses`, `totalCredits`, `verification`, `verificationNote`, nullable `verifiedAt`, `sources`, `groups`, `courses`.

Verification is `FICTIONAL`, `UNVERIFIED`, or `VERIFIED`. Verified documents require a date (`YYYY-MM-DD`), top-level HTTPS source references and at least one HTTPS source per course. A source object contains `url` and `note`. Sources and the verified status reflect administrator review; the importer cannot authenticate university policy by itself.

An elective group is `{ "id": "major", "title": "Major electives", "credits": 6 }`. A required course has `electiveGroup: null`; an option refers to an existing group ID. Required credits plus the groups’ required credits must equal the degree total. Each group must contain a feasible credit combination. A course may belong to only one group; overlapping double-counting is deliberately unsupported.

```json
{
  "code": "DEMO202",
  "title": "Fictional example course",
  "credits": 3,
  "semester": 4,
  "category": "Computing",
  "electiveGroup": null,
  "description": null,
  "sources": [],
  "requirement": {
    "type": "all",
    "items": [
      { "type": "course", "code": "DEMO101" },
      {
        "type": "any",
        "items": [
          { "type": "course", "code": "DEMO102" },
          { "type": "credits", "minimum": 60 }
        ]
      }
    ]
  }
}
```

All referenced course codes must occur in the same version. Course prerequisites cannot self-reference or form cycles. Corequisite pairs may be concurrent; strict prerequisite cycles are rejected. `requirement: null` means no known prerequisite **only after an administrator verifies that meaning**. Do not turn unavailable university information into a null rule and label it verified.

Supported requirement expressions:

| Type          | Fields    | Meaning                                                          |
| ------------- | --------- | ---------------------------------------------------------------- |
| `course`      | `code`    | Must have completed the referenced course                        |
| `corequisite` | `code`    | Completed or selected in the same term                           |
| `credits`     | `minimum` | At least this many earned degree credits                         |
| `approval`    | `label`   | External permission required; remains blocked in student planner |
| `all`         | `items`   | Every nested rule                                                |
| `any`         | `items`   | At least one nested rule                                         |

## CSV

CSV imports accept course rows plus a separate metadata JSON object containing the top-level curriculum fields without `courses`. Column names:

```csv
code,title,credits,semester,category,electiveGroup,description,requirement,sources
DEMO101,Example foundation,3,1,Foundation,,,,
DEMO202,Example follow-up,3,2,Computing,,,"{""type"":""course"",""code"":""DEMO101""}",[]
```

`credits` and `semester` must be integers. Empty elective/description/requirement cells become null. Empty sources become an empty list. Requirements and source lists use JSON escaped using normal CSV quotes. Unknown columns, malformed expressions, nonexistent references, duplicate codes, impossible elective totals and oversized files are rejected. CSV does not merge incompatible versions. For complex curricula, prefer a single reviewable JSON file.

## AAU review process

The initial public source review is in `database/data/aau-source-review.json`. It is not imported as a usable official plan because admission-year applicability and some credit notation remain unresolved. Keep the source documents for a single identified version together, confirm their campus applicability, resolve ambiguities with an academic adviser, and record references for all courses before publishing as verified. Never access private portals without authorization or infer eligibility from AI-generated rules.
