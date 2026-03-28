# Research Data

This folder contains source-backed food-library research artifacts and generated datasets.

Current files:
- `memphis-metro-chain-food-library-first-pass.csv`
- `memphis-metro-chain-food-library-first-pass.md`
- `build_food_library_datasets.py`

Generation flow:
1. Parse the annual menu workbook from `/Users/kp/Downloads/ms_annual_data_2022.xls`
2. Normalize it into an app-friendly CSV
3. Overlay Memphis manual official-source rows as higher-trust overrides

Generated outputs:
- `annual-chain-food-library-2022-normalized.csv`
- `food-library-merged.csv`
- `food-library-merged-summary.md`
- `public/restaurant-library.json`

Run:

```bash
python3 research/build_food_library_datasets.py
```
