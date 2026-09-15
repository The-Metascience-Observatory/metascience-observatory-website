# Image findings

`findings.json` contains the PubPeer image-finding submissions. The original
PNGs live in `public/assets/forensic-metascience-agent/image-findings/`. The
Tenbaum entry uses the source document's YouTube comparison because that entry
has no embedded image. PubPeer URLs include Word field-code hyperlinks;
meaningless `#null` fragments were removed. Submission dates are stored as ISO
dates. Wide comparison figures (aspect ratio ≥ 2.5, or `wide: true`) render
full-width. A finding may include one `image` or an `images` array.

Citation metadata is fetched by calling
`data_ingestor.fetch_metadata_from_doi.fetch_metadata_from_doi(doi)` for each DOI.
The complete returned metadata is retained in each entry's `citation` field.
The page displays every author, normalizes all-capital author names for readability,
and omits the issue when the metadata provider does not supply one.
Metadata is stored locally so rendering does not depend on external API calls.
