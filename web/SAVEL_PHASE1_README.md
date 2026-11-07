# SAVEL Phase 1 — replacement frontend source

**This is a self-contained alternative to the files Cursor generated.** It should only be applied after making a backup of the current `src` directory. The uploaded `App.jsx`, `App.css`, and `index.css` were Vite starter files; the other Cursor-generated modules were not among those uploaded.

## Installing into the actual team repository

1. Save this ZIP to `~/Downloads`.
2. Make a backup outside the Git repository:

```bash
mkdir -p ~/Desktop/SAVEL-backups
cp -R ~/Desktop/SAVEL/savel/web/src ~/Desktop/SAVEL-backups/src-before-chatgpt
```

3. From Terminal, apply the ZIP:

```bash
cd ~/Desktop/SAVEL/savel/web
unzip -o ~/Downloads/SAVEL_Phase1_Web_Patch.zip -d .
```

4. The other older Vite server may be running on port 5173. Stop that server using Control+C in its terminal, then:

```bash
cd ~/Desktop/SAVEL/savel/web
npm run dev
```

5. Open the URL Vite prints, normally `http://localhost:5173/`.
6. Check the page, then run `npm run build` in another Terminal tab.

## Scope

Phase 1 only; 40 deterministic mock homes, SVG map fallback, top-10 ranked queue, temperature chart, scripted call display, incident feed, disabled simulated controls, and honest accuracy placeholders. No real API calls or dispatch. Frontend source only; does not modify the backend or infrastructure.

## Notes

Use existing `web/package.json` and node_modules from the project (already installed `leaflet`, `react-leaflet`, `recharts`, `lucide-react`). This ZIP intentionally does not modify the team's package file, Vite proxy, or deployment config.
