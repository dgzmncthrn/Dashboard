# Quality Ops Dashboard (Offline)

This dashboard works offline in your browser and uses:
- 2 separate CSV uploads (Defects/Findings + Opportunities)
- Pareto analysis
- Fishbone analysis
- CAPA tracker table
- Light/Dark mode

## Files you need
Keep these files together in the same folder:
- `index.html`
- `styles.css`
- `script.js`

## Run locally
```bash
python3 -m http.server 8000
```
Then open `http://localhost:8000`.

## CSV column tips
Defects file should have columns close to:
- `Category`
- `Root Cause`
- `Count` (optional)

Opportunities file should have columns close to:
- `ID`
- `Issue` or `Title`
- `Owner`
- `Due Date`
- `Status`
