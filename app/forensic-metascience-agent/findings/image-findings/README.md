# Image findings

`findings.json` contains the six submissions from `image PubPeer submissions.docx`.
The original five PNGs were extracted without modification into
`public/assets/forensic-metascience-agent/image-findings/`. The Tenbaum entry uses
the source document's YouTube comparison because that entry has no embedded image.
PubPeer URLs include Word field-code hyperlinks; meaningless `#null` fragments
were removed. Submission dates are stored as ISO dates.

Citation metadata was fetched on September 10, 2026 by calling
`data_ingestor.fetch_metadata_from_doi.fetch_metadata_from_doi(doi)` for each DOI.
The complete returned metadata is retained in each entry's `citation` field.
The page displays every author, normalizes all-capital author names for readability,
and omits the issue when the metadata provider does not supply one.
Metadata is stored locally so rendering does not depend on external API calls.
