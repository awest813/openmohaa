# Importing Game Assets

OpenMoHAA is a reimplementation of the **Medal of Honor: Allied Assault**
engine. It does **not** include any original game assets — you must own a
legal copy of the game and supply the files yourself.

## Required Files

### Medal of Honor: Allied Assault (base game)

Copy the `.pk3` files from your MOHAA installation's `main/` directory:

```
pak0.pk3
pak1.pk3
pak2.pk3
pak3.pk3
pak4.pk3
pak5.pk3
```

### Spearhead (expansion)

Copy `.pk3` files from the `mainta/` directory.

### Breakthrough (expansion)

Copy `.pk3` files from the `maintt/` directory.

## How the Web Launcher Works

1. Open the OpenMoHAA HTML page in your browser.
2. **Drag and drop** your `.pk3` files onto the import area, or click to
   browse.
3. Files are stored in your browser's **IndexedDB** — they persist across
   sessions and page reloads without uploading anything to a server.
4. Click **Start OpenMoHAA** to boot the engine.

### Storage Details

| Item | Detail |
|------|--------|
| **Storage backend** | IndexedDB (`openmohaa-assets` database) |
| **Persistence** | Files survive page reloads and browser restarts |
| **Privacy** | Files never leave your machine |
| **Size limit** | Depends on browser; typically several GB |

### Clearing Assets

Click **Clear Stored Assets** in the launcher to delete all stored files
from IndexedDB.

## Virtual File System Layout

The loader places imported files into the Emscripten virtual filesystem
at these paths:

```
/persistent/openmohaa/main/       ← Allied Assault .pk3 files
/persistent/openmohaa/mainta/     ← Spearhead .pk3 files
/persistent/openmohaa/maintt/     ← Breakthrough .pk3 files
```

The engine's `fs_basepath` and `fs_homepath` are set to
`/persistent/openmohaa` so it finds assets the same way as a native
install.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "No pak files found" | Make sure you imported the base-game `.pk3` files (at least `pak0.pk3`) |
| Files disappear | Private / incognito mode may restrict IndexedDB; use a normal window |
| Import seems stuck | Large `.pk3` files take time to read into memory; check the status bar |
| Wrong expansion loaded | The loader guesses the target directory from folder names in the path; drop files from the correct folder or rename them |
