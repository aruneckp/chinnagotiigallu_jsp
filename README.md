# Chinnagottigallu voter analytics · ZPTC

React + Vite static site for 21,253 voters from the polling-station-enriched
CSV, with MPTC, Gram Panchayat, station, and family analytics.

## Analytics

- Overview summaries for MPTC constituencies, Gram Panchayats / wards, polling stations, age, gender, families, and households.
- Voter search, filters, profile details, CSV export, and print.
- Analysis breakdowns and charts by MPTC, Gram Panchayat, polling station, assembly polling part, age, gender, family, and household.
- Polling-station metadata includes building, locality, house/serial ranges, station totals, voter category, and source CSV match status.
- Family matches crossing Gram Panchayats are not assumed correct: they are excluded from automatic linking and flagged for review.

## Updating the dataset

The app loads the generated `src/data/voters.json`. Rebuild it from the updated voter CSV and its matching csv-family-tree `page_data.json`:

```
python3 scripts/prepare_data.py \
	--family-dir "/path/to/csv-family-tree" \
	--csv "/path/to/chinnagottigallu_voters_with_polling_stations.csv" \
	--page-data "/path/to/csv-family-tree/family_out/page_data.json" \
	--place "Chinnagottigallu"
```

The importer validates row count and each row's voter name, age, and house number against the family data before generating the JSON.

## Sensitive voter data

Voter IDs, names, and other personal details are sensitive. Keep the Git repository private. The source JSON is readable in the repository; the production build encrypts the bundled dataset at build time. Keep `.env`, source CSV files, and generated data out of public repositories. Rotate credentials if they have been shared.

## Local development

Set `VOTER_USER` and `VOTER_PASS` in `.env`, then run `npm ci`, `npm run dev`, or `npm run build`.
