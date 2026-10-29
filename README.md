# MrJoshua's ARK Sample Manager

**Use it online: https://mrjoshmurray.github.io/mrjoshuas-ark-sample-manager/**

Turn a big folder of samples into a ready-to-use sample pack for the Befaco ARK.

It searches your library (including every subfolder), picks out WAVs in the format ARK needs, removes duplicates, sorts them into the eight ARK banks, and puts them in a `WAV` folder ready to copy onto your SD card.

Everything runs in your web browser. Nothing is uploaded, nothing is installed, and your original files are only copied, never changed or moved.

**How it chooses:** files are sorted by looking for words like "kick", "snare", "hat" or "pad" in the file name and its folder names, plus file size to tell short one-shots from long loops and textures. The app can't hear the audio, so a few files may land in the wrong bank.

## Quick start

1. Keep all the files in this folder together.
2. Open `index.html` in Chrome, Edge, Safari or Firefox (double-click it, or drag it into a browser window).
3. Follow the three steps on the page, then press **Build sample pack**.

## Using it

### 1. Your samples
Press **Choose sample folder** and pick the folder that holds your samples. Subfolders are searched too, however deep.

If your browser can't pick a whole folder (common on phones and tablets), press **Or choose WAV files** and select the files instead.

### 2. Where to put the pack
- **Save into a folder**: pick a destination, such as your ARK SD card. A `WAV` folder with `1` to `8` inside is created there. Files already in it are never overwritten, and each bank stops at 128 samples including what is already there.
- **Download as WAV.zip**: the pack downloads as a ZIP. Unzip it so the `WAV` folder sits in the root of the SD card. On a phone or tablet, unzip it in the Files app first.

### 3. Banks
Set how many samples you want in each bank (0 to 128). Smaller numbers give a smaller, more selective pack.

**Max samples from any one folder** limits how much any single sample pack can contribute to a bank, which keeps the selection varied.

Tick **Preview only** to see what would be chosen without copying anything.

## What goes where

| Folder | Bank | Contents |
|---|---|---|
| `WAV/1` | Kick Drums | Acoustic, 808/909 and sub kicks |
| `WAV/2` | Snares & Claps | Snares, rimshots, claps, snaps |
| `WAV/3` | Hi-Hats & Cymbals | Closed and open hats, rides, crashes |
| `WAV/4` | Percussion & Toms | Shakers, tambourines, congas, bongos, toms |
| `WAV/5` | Breakbeats & Drum Loops | Full loops for the Slicer engine |
| `WAV/6` | Vocal Samples & Cuts | Vocal stabs and phrases for the Granular engine |
| `WAV/7` | Bass & Synth Stabs | Bass hits, chord stabs, melodic one-shots |
| `WAV/8` | Atmospheres, Pads & Drones | Long textures and ambient beds |

## What counts as a usable sample

ARK needs **16-bit, 44.1 kHz** WAV files (mono or stereo) with file names of **25 characters or fewer** (not counting `.wav`). The app:

- skips any WAV that isn't 16-bit 44.1 kHz, so it never copies something ARK can't play
- tidies file names to letters, numbers, `_`, `-` and `+`, and shortens them to 25 characters
- adds a number to the end of a name if two files would clash
- skips duplicate files with the same name and size

It does **not** convert audio. If you have 24-bit or 48 kHz samples you want to use, convert them to 16-bit 44.1 kHz in an audio editor first.

## Good to know

- **Sorting is by file and folder names.** It looks for words like "kick", "snare" or "pad" and uses the file size to tell one-shots from loops. A few samples will end up in the wrong bank, so give each bank a listen.
- **Results are repeatable.** Running it again on the same library gives the same selection.
- **Cloud libraries.** If your samples live in iCloud, OneDrive or similar and aren't downloaded, your computer will fetch them as the app reads them, which can take a while.
- **ZIP size limit.** A ZIP can't be bigger than 4 GB. If you hit this, lower the per-bank counts or save to a folder instead.

## Browser support

| Browser | Choose sample folder | Output |
|---|---|---|
| Chrome or Edge on macOS, Windows, Linux | Folder picker | Folder or ZIP |
| Safari, Firefox | Folder picker or file picker, depending on version | ZIP |
| iPhone, iPad | Pick WAV files | ZIP |
| Android | Folder or file picker, depending on browser | ZIP |

Only Chrome and Edge on a computer can write straight into a folder. Everywhere else the pack downloads as `WAV.zip`.

## Files in this folder

| File | Purpose |
|---|---|
| `index.html` | The page you open |
| `style.css` | Layout and look |
| `app.js` | The app logic |
| `rules.js` | Sorting rules and WAV format check |
| `zip.js` | Builds the ZIP download |
