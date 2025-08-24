
# Pepperpot (Static HTML)

This is a static, GitHub Pages–friendly version of your Streamlit app.
It uses **localStorage** for accounts and preferences, and **Papa Parse** (CDN) to read CSVs in the browser.

## Files
- `index.html` – Home (sign up / login with *dance + color*)
- `my-account.html` – Profile + Theme + change login combo
- `cda-lookup.html` – Proficiency point lookup (upload a CSV or place `PPMid-March2025.csv` in the repo root)
- `app.css`, `app.js` – Shared styles and logic
- `assets/pepperpot_wordmark.png` – Placeholder logo. Replace with your real wordmark (same filename).

## Deploy (GitHub Pages)
1. Create a new GitHub repo and upload everything in this folder to the repo root.
2. (Optional) Add your CSV as `PPMid-March2025.csv` at the repo root if you want the "Use local file" toggle to work.
3. In **Settings → Pages**, set **Source** to `Deploy from a branch`, **Branch** to `main` (or `gh-pages`) and `/ (root)`.
4. Visit the URL GitHub gives you (usually `https://<user>.github.io/<repo>/`).

## Notes
- Accounts/passwords are **browser-local** only (localStorage). For real multi-user auth, you'd need a backend.
- The *dance + color* login hash is: `SHA-256(username + '|' + dance + '|' + colorHex + '|' + salt)`.
- The CDA table colors come from your Account → Theme page and default to the same values used in Streamlit.
