/**
 * OpenMoHAA Web Loader
 *
 * Handles:
 *  1. Importing user-supplied .pk3 game assets via drag-and-drop or file picker.
 *  2. Persisting them in IndexedDB through Emscripten's IDBFS.
 *  3. Bootstrapping the Emscripten module and launching the engine.
 */

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const launcher    = document.getElementById("launcher");
const canvas      = document.getElementById("canvas");
const dropZone    = document.getElementById("drop-zone");
const fileInput   = document.getElementById("file-input");
const fileListEl  = document.getElementById("file-list");
const btnStart    = document.getElementById("btn-start");
const btnClear    = document.getElementById("btn-clear-assets");
const statusBar   = document.getElementById("status-bar");
const outputArea  = document.getElementById("output");
const outputCtr   = document.getElementById("output-container");

// ---------------------------------------------------------------------------
// Configuration — loaded from the companion JSON emitted by CMake
// ---------------------------------------------------------------------------

/** @type {{ gameDirectories: Record<string,string>, persistRoot: string, engineArgs: string[] }} */
let config = {
    gameDirectories: {
        main:   "/persistent/openmohaa/main",
        mainta: "/persistent/openmohaa/mainta",
        maintt: "/persistent/openmohaa/maintt"
    },
    persistRoot: "/persistent",
    engineArgs: []
};

async function loadConfig() {
    try {
        // The CMake deploy step names this <CLIENT_NAME>-config.json
        const resp = await fetch(location.href.replace(/\.html$/, "-config.json"));
        if (resp.ok) {
            config = await resp.json();
        }
    } catch {
        // Use built-in defaults
    }
}

// ---------------------------------------------------------------------------
// IndexedDB-backed asset storage (independent of Emscripten runtime)
// ---------------------------------------------------------------------------

const DB_NAME    = "openmohaa-assets";
const DB_VERSION = 1;
const STORE_NAME = "files";

/** @returns {Promise<IDBDatabase>} */
function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            req.result.createObjectStore(STORE_NAME);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
    });
}

/**
 * Store a file blob in IndexedDB keyed by its virtual path.
 *
 * @param {IDBDatabase} db
 * @param {string} path  Virtual FS path (e.g. "/persistent/openmohaa/main/pak0.pk3")
 * @param {ArrayBuffer} data
 */
function dbPut(db, path, data) {
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(data, path);
        tx.oncomplete = resolve;
        tx.onerror    = () => reject(tx.error);
    });
}

/** @returns {Promise<string[]>} all stored virtual paths */
function dbKeys(db) {
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req   = store.getAllKeys();
        req.onsuccess = () => resolve(/** @type {string[]} */ (req.result));
        req.onerror   = () => reject(req.error);
    });
}

/** @returns {Promise<ArrayBuffer|undefined>} */
function dbGet(db, key) {
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req   = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
    });
}

function dbClear(db) {
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        tx.oncomplete = resolve;
        tx.onerror    = () => reject(tx.error);
    });
}

// ---------------------------------------------------------------------------
// Guess which game directory a file belongs to
// ---------------------------------------------------------------------------

/**
 * Map a file name to its virtual FS directory.
 * Files are placed into `main/` by default unless the user drops a folder
 * whose name matches an expansion directory.
 *
 * @param {File} file
 * @returns {string} Virtual directory path
 */
function resolveDirectory(file) {
    // webkitRelativePath is set when a directory is dropped
    const rel = file.webkitRelativePath || file.name;
    const parts = rel.split("/");

    for (const [dirName, dirPath] of Object.entries(config.gameDirectories)) {
        if (parts.some(p => p.toLowerCase() === dirName.toLowerCase())) {
            return dirPath;
        }
    }
    // Default to base game
    return config.gameDirectories.main;
}

// ---------------------------------------------------------------------------
// File import logic
// ---------------------------------------------------------------------------

async function importFiles(/** @type {FileList|File[]} */ files) {
    const db = await openDB();
    let imported = 0;

    for (const file of files) {
        if (!file.name.toLowerCase().endsWith(".pk3")) continue;

        setStatus(`Importing ${file.name} …`);
        const buf  = await file.arrayBuffer();
        const dir  = resolveDirectory(file);
        const path = `${dir}/${file.name}`;
        await dbPut(db, path, buf);
        imported++;
    }

    db.close();
    setStatus(`Imported ${imported} file(s).`);
    await refreshFileList();
}

async function refreshFileList() {
    const db   = await openDB();
    const keys = await dbKeys(db);
    db.close();

    fileListEl.innerHTML = "";
    for (const key of keys) {
        const el = document.createElement("div");
        el.className = "file-entry";
        el.textContent = key;
        fileListEl.appendChild(el);
    }

    btnStart.disabled = keys.length === 0;
}

async function clearAssets() {
    const db = await openDB();
    await dbClear(db);
    db.close();
    setStatus("All stored assets cleared.");
    await refreshFileList();
}

// ---------------------------------------------------------------------------
// Engine bootstrap
// ---------------------------------------------------------------------------

/**
 * Write all IndexedDB-stored assets into the Emscripten virtual FS,
 * then call the engine entry point.
 */
async function launchEngine() {
    setStatus("Loading engine …");
    btnStart.disabled = true;

    // Dynamically import the Emscripten-generated ES6 module.
    // The module file name matches the CMake CLIENT_NAME.
    const scriptEl = document.querySelector("script[src='openmohaa-loader.js']");
    const basePath = scriptEl ? scriptEl.src.replace(/openmohaa-loader\.js$/, "") : "./";
    const pageName = location.pathname.split("/").pop().replace(/\.html$/, "");

    let createModule;
    try {
        const mod = await import(`${basePath}${pageName}.js`);
        createModule = mod.default;
    } catch (err) {
        setStatus(`Failed to load engine module: ${err.message}`);
        btnStart.disabled = false;
        return;
    }

    // Prepare Emscripten Module overrides
    const moduleOverrides = {
        canvas: canvas,
        print:  (text) => appendOutput(text),
        printErr: (text) => appendOutput(`[err] ${text}`),
        // Create the persistent mount point before main() runs
        preRun: [
            async function(Module) {
                // Create directories
                for (const dir of Object.values(config.gameDirectories)) {
                    Module.FS.mkdirTree(dir);
                }

                // Copy assets from IndexedDB into the virtual FS
                const db   = await openDB();
                const keys = await dbKeys(db);
                for (const key of keys) {
                    const data = await dbGet(db, key);
                    if (data) {
                        Module.FS.writeFile(key, new Uint8Array(data));
                    }
                }
                db.close();
                setStatus("Assets loaded into virtual FS.");
            }
        ],
        arguments: config.engineArgs,
        noInitialRun: false
    };

    // Switch UI: hide launcher, show canvas
    launcher.style.display = "none";
    canvas.style.display = "block";
    outputCtr.style.display = "block";

    // Focus the canvas so keyboard input is captured
    canvas.focus();

    try {
        await createModule(moduleOverrides);
    } catch (err) {
        setStatus(`Engine error: ${err.message}`);
        appendOutput(`[fatal] ${err.message}\n${err.stack || ""}`);
    }
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function setStatus(msg) {
    statusBar.textContent = msg;
}

function appendOutput(text) {
    if (outputArea) {
        outputArea.value += text + "\n";
        outputArea.scrollTop = outputArea.scrollHeight;
    }
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

dropZone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
    if (e.target.files.length) importFiles(e.target.files);
});

dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files);
});

btnStart.addEventListener("click", launchEngine);
btnClear.addEventListener("click", clearAssets);

// Prevent right-click context menu over the canvas during gameplay
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

(async () => {
    await loadConfig();
    await refreshFileList();
})();
