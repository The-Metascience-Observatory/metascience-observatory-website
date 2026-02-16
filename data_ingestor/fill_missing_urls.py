#!/usr/bin/env python3
"""
Fill missing URLs in the database by searching for DOIs using the metadata enrichment pipeline.
"""

import pandas as pd
import sys
import time
from pathlib import Path

# Import the fetch functions
from fetch_metadata_from_title import fetch_metadata_from_title

def fill_missing_urls(input_csv, output_csv=None):
    """Fill missing original_url and replication_url by searching with titles."""
    df = pd.read_csv(input_csv)

    print(f"Loaded {len(df)} rows from {input_csv}")

    # Find rows with missing URLs but with titles
    missing_original = df['original_url'].isna() & df['original_title'].notna()
    missing_replication = df['replication_url'].isna() & df['replication_title'].notna()

    print(f"\nRows missing original_url with title available: {missing_original.sum()}")
    print(f"Rows missing replication_url with title available: {missing_replication.sum()}")

    updated_count = 0

    # Process missing original URLs
    print("\n" + "="*80)
    print("Processing missing original URLs...")
    print("="*80)

    for idx in df[missing_original].index:
        row = df.loc[idx]
        title = row['original_title']
        authors = row.get('original_authors')
        journal = row.get('original_journal')
        year = row.get('original_year')

        print(f"\nRow {idx + 1}: {title[:60]}...")

        # Fetch metadata
        metadata = fetch_metadata_from_title(
            title,
            authors=authors,
            journal=journal,
            year=year
        )

        if metadata and metadata.get('doi'):
            doi = metadata['doi']
            url = f"https://doi.org/{doi}"
            df.at[idx, 'original_url'] = url
            print(f"  ✓ Found DOI: {url}")
            updated_count += 1
        elif metadata and metadata.get('pmid'):
            pmid_url = f"https://pubmed.ncbi.nlm.nih.gov/{metadata['pmid']}/"
            df.at[idx, 'original_url'] = pmid_url
            print(f"  ✓ Found PMID: {pmid_url}")
            updated_count += 1
        elif metadata and metadata.get('url'):
            df.at[idx, 'original_url'] = metadata['url']
            print(f"  ✓ Found URL: {metadata['url']}")
            updated_count += 1
        else:
            print(f"  ✗ Could not find URL")

        time.sleep(0.5)  # Rate limiting

    # Process missing replication URLs
    print("\n" + "="*80)
    print("Processing missing replication URLs...")
    print("="*80)

    for idx in df[missing_replication].index:
        row = df.loc[idx]
        title = row['replication_title']
        authors = row.get('replication_authors')
        journal = row.get('replication_journal')
        year = row.get('replication_year')

        print(f"\nRow {idx + 1}: {title[:60]}...")

        # Fetch metadata
        metadata = fetch_metadata_from_title(
            title,
            authors=authors,
            journal=journal,
            year=year
        )

        if metadata and metadata.get('doi'):
            doi = metadata['doi']
            url = f"https://doi.org/{doi}"
            df.at[idx, 'replication_url'] = url
            print(f"  ✓ Found DOI: {url}")
            updated_count += 1
        elif metadata and metadata.get('pmid'):
            pmid_url = f"https://pubmed.ncbi.nlm.nih.gov/{metadata['pmid']}/"
            df.at[idx, 'replication_url'] = pmid_url
            print(f"  ✓ Found PMID: {pmid_url}")
            updated_count += 1
        elif metadata and metadata.get('url'):
            df.at[idx, 'replication_url'] = metadata['url']
            print(f"  ✓ Found URL: {metadata['url']}")
            updated_count += 1
        else:
            print(f"  ✗ Could not find URL")

        time.sleep(0.5)  # Rate limiting

    print("\n" + "="*80)
    print(f"Summary: Updated {updated_count} URLs")
    print("="*80)

    # Save output
    if output_csv is None:
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y_%m_%d_%H%M%S")
        output_csv = f"../data/replications_database_{timestamp}.csv"

    df.to_csv(output_csv, index=False)
    print(f"\nSaved to: {output_csv}")

    return df


if __name__ == "__main__":
    input_file = "../data/replications_database_2026_02_15_103418.csv"

    if len(sys.argv) > 1:
        input_file = sys.argv[1]

    fill_missing_urls(input_file)
