(() => {
  const $ = (id) => document.getElementById(id);
  const canPickDir = typeof window.showDirectoryPicker === "function";

  let srcHandle = null;     // directory handle (Chromium desktop)
  let srcPicked = null;     // [{path, file}] from <input> fallbacks
  let srcLabel = "";
  let destHandle = null;
  let busy = false;

  for (const b in BANKS) {
    const tr = $("bankTable").tBodies[0].insertRow();
    tr.insertCell().textContent = `${b}. ${BANKS[b]}`;
    const n = document.createElement("input");
    Object.assign(n, { type: "number", min: 0, max: BANK_SIZE, value: DEFAULT_TARGETS[b], id: "t" + b });
    const c1 = tr.insertCell();
    c1.dataset.label = "Samples";
    c1.append(n);
  }

  $("outFolder").disabled = !canPickDir;
  $("outFolder").checked = canPickDir;
  $("outZip").checked = !canPickDir;
  $("capNote").textContent = canPickDir
    ? ""
    : "This browser can't write to folders directly, so the pack is downloaded as a ZIP. On a phone or tablet, unzip it in your Files app and copy the WAV folder to the SD card.";

  function refresh() {
    const haveSrc = !!(srcHandle || srcPicked);
    const toFolder = $("outFolder").checked;
    $("destRow").hidden = !toFolder;
    $("destInfo").textContent = destHandle ? destHandle.name : "No folder chosen";
    $("go").disabled = busy || !haveSrc || (toFolder && !$("dry").checked && !destHandle);
    $("go").classList.toggle("busy", busy);
    $("go").textContent = busy ? "Working..." : "Build sample pack";
  }

  // frac null shows an animated bar for work of unknown length.
  function progress(frac, text) {
    const bar = $("bar");
    bar.hidden = false;
    if (frac == null) bar.removeAttribute("value"); else bar.value = frac;
    $("status").textContent = frac == null ? text : `${text} (${Math.round(frac * 100)}%)`;
  }

  function fail(e) {
    $("error").textContent = e && e.message ? e.message : String(e);
    $("status").textContent = "";
    $("bar").hidden = true;
  }

  $("pickSrc").onclick = async () => {
    if (!canPickDir) return $("srcDirInput").click();
    try {
      srcHandle = await window.showDirectoryPicker({ id: "ark-src" });
      srcPicked = null;
      srcLabel = srcHandle.name;
      $("srcInfo").textContent = `Folder: ${srcLabel}`;
    } catch (e) { if (e.name !== "AbortError") fail(e); }
    refresh();
  };
  $("pickFiles").onclick = () => $("srcFilesInput").click();

  function fromInput(input, isDir) {
    const files = [...input.files];
    input.value = "";
    if (!files.length) return;
    srcHandle = null;
    srcPicked = files.map((f) => {
      let path = f.webkitRelativePath || f.name;
      if (isDir && f.webkitRelativePath) path = path.slice(path.indexOf("/") + 1);
      return { path, file: f };
    });
    const wavs = srcPicked.filter((x) => /\.wav$/i.test(x.path)).length;
    srcLabel = `${files.length} files`;
    $("srcInfo").textContent = `${files.length} files chosen (${wavs} WAV).`;
    refresh();
  }
  $("srcDirInput").onchange = (e) => fromInput(e.target, true);
  $("srcFilesInput").onchange = (e) => fromInput(e.target, false);

  $("pickDest").onclick = async () => {
    try {
      destHandle = await window.showDirectoryPicker({ id: "ark-dest", mode: "readwrite" });
    } catch (e) { if (e.name !== "AbortError") fail(e); }
    refresh();
  };
  for (const id of ["outFolder", "outZip", "dry"]) $(id).onchange = refresh;

  async function walk(dir, prefix, out, skipPath, onCount) {
    for await (const [name, h] of dir.entries()) {
      if (name.startsWith(".") || name === "__MACOSX") continue;
      const path = prefix + name;
      if (h.kind === "directory") {
        if (path !== skipPath) await walk(h, path + "/", out, skipPath, onCount);
      } else if (/\.wav$/i.test(name)) {
        try { out.push({ path, file: await h.getFile() }); } catch (e) { /* unreadable file */ }
        if (out.length % 25 === 0) onCount(out.length);
      }
    }
  }

  async function collect(toFolder) {
    const status = (n) => progress(null, `Scanning folders... ${n} WAV files found`);
    status(0);
    if (srcPicked) {
      return srcPicked.filter((x) => /\.wav$/i.test(x.path) && !x.path.split("/").some((s) => s.startsWith(".") || s === "__MACOSX"));
    }
    let skip = null;
    if (toFolder && destHandle) {
      const r = await srcHandle.resolve(destHandle); // so a WAV folder inside the library isn't re-read
      if (r) skip = [...r, "WAV"].join("/");
    }
    const out = [];
    await walk(srcHandle, "", out, skip, status);
    return out;
  }

  async function subDir(parent, name, create) {
    try { return await parent.getDirectoryHandle(name, { create }); } catch (e) {
      if (e.name === "NotFoundError") return null;
      throw e;
    }
  }

  async function run() {
    busy = true; refresh();
    $("error").textContent = ""; $("results").textContent = "";
    $("bar").hidden = false; $("bar").removeAttribute("value");
    $("status").scrollIntoView({ behavior: "smooth", block: "nearest" });
    try {
      const dry = $("dry").checked, toFolder = $("outFolder").checked;
      const perFolder = Math.max(1, Math.min(1000, parseInt($("perFolder").value, 10) || 10));
      const targets = {};
      for (const b in BANKS) {
        targets[b] = Math.max(0, Math.min(BANK_SIZE, parseInt($("t" + b).value, 10) || 0));
      }
      const rng = makeRng(1);

      const files = await collect(toFolder);
      const cands = {};
      progress(null, `Found ${files.length} WAV files. Sorting...`);
      for (const b in BANKS) cands[b] = [];
      for (const x of files) {
        const b = classify(x.path, x.file.size);
        if (b) cands[b].push(x);
      }
      progress(null, `Found ${files.length} WAV files. Checking formats...`);

      let wavRoot = null;
      if (toFolder && !dry) wavRoot = await subDir(destHandle, "WAV", true);
      else if (toFolder && destHandle) wavRoot = await subDir(destHandle, "WAV", false);

      const seen = new Set(), plan = {}, summary = [];
      const chk = dry ? 1 : 0.4; // share of the bar used by format checking; the rest is copying
      let bi = 0;
      for (const b in BANKS) {
        progress((bi / 8) * chk, `Checking bank ${b} of 8: ${BANKS[b]}`);
        const taken = new Set();
        let existing = 0;
        const bankDir = wavRoot && (await subDir(wavRoot, b, false));
        if (bankDir) {
          for await (const [n] of bankDir.entries()) {
            taken.add(n.toLowerCase());
            if (/\.wav$/i.test(n)) existing++;
          }
        }
        const want = Math.max(0, Math.min(targets[b], BANK_SIZE - existing));
        const groups = new Map();
        const pool = [...cands[b]].sort((p, q) => p.path.split("/").length - q.path.split("/").length);
        for (const x of pool) {
          const key = x.path.slice(x.path.lastIndexOf("/") + 1).toLowerCase() + "|" + x.file.size;
          if (seen.has(key)) continue;
          const dir = x.path.slice(0, x.path.lastIndexOf("/"));
          if (!groups.has(dir)) groups.set(dir, []);
          groups.get(dir).push({ key, x });
        }
        const glist = [...groups.values()];
        shuffle(glist, rng);
        glist.forEach((g) => shuffle(g, rng));
        const order = [];
        for (let i = 0; i < perFolder; i++) for (const g of glist) if (i < g.length) order.push(g[i]);

        const chosen = [];
        for (let i = 0; i < order.length && chosen.length < want; i += 48) {
          const chunk = order.slice(i, i + 48).filter((o) => !seen.has(o.key));
          const good = await Promise.all(chunk.map((o) => isArkWav(o.x.file)));
          chunk.forEach((o, k) => {
            if (good[k] && chosen.length < want && !seen.has(o.key)) { seen.add(o.key); chosen.push(o.x); }
          });
          progress(((bi + Math.min(1, chosen.length / Math.max(1, want))) / 8) * chk,
            `Checking bank ${b} of 8: ${BANKS[b]}, ${chosen.length} of ${want} chosen`);
        }
        bi++;
        chosen.sort((p, q) => (p.path < q.path ? -1 : 1));
        plan[b] = chosen.map((x) => {
          const stem = cleanStem(x.path);
          let n = stem, k = 2;
          while (taken.has((n + ".wav").toLowerCase())) {
            const suf = "_" + k++;
            n = stem.slice(0, MAX_STEM - suf.length) + suf;
          }
          taken.add((n + ".wav").toLowerCase());
          return { name: n + ".wav", file: x.file };
        });
        summary.push({ b, found: cands[b].length, chosen: plan[b].length, existing });
      }

      if (!dry) {
        progress(chk, toFolder ? "Copying files" : "Building ZIP");
        if (toFolder) await writeFolder(wavRoot, plan);
        else await downloadZip(plan);
      }
      progress(1, "Finished");
      $("status").textContent = dry
        ? "Preview complete. Nothing was copied."
        : toFolder ? `Done. The WAV folder is in "${destHandle.name}". Copy it to the root of your ARK SD card if it isn't there already.`
          : "Done. Unzip WAV.zip so the WAV folder sits in the root of your ARK SD card.";
      showResults(summary, plan);
    } catch (e) {
      fail(e);
    } finally {
      busy = false; refresh();
    }
  }

  async function writeFolder(wavRoot, plan) {
    const total = Object.values(plan).reduce((s, p) => s + p.length, 0);
    let done = 0;
    for (const b in BANKS) {
      if (!plan[b].length) continue;
      const dir = await wavRoot.getDirectoryHandle(b, { create: true });
      for (const { name, file } of plan[b]) {
        await writeBlob(dir, name, file);
        done++;
        progress(0.4 + 0.6 * (done / Math.max(1, total)), `Copying file ${done} of ${total}`);
      }
    }
  }

  async function writeBlob(dir, name, blob) {
    const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
    await w.write(blob);
    await w.close();
  }

  async function downloadZip(plan) {
    const entries = [];
    for (const b in BANKS) {
      for (const { name, file } of plan[b]) entries.push({ path: `WAV/${b}/${name}`, blob: file });
    }
    const zip = await Zip.build(entries, (i, n) => progress(0.4 + 0.6 * (i / n), `Building ZIP: file ${i} of ${n}`));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(zip);
    a.download = "WAV.zip";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }

  function showResults(summary, plan) {
    const box = $("results");
    box.textContent = "";
    for (const { b, found, chosen, existing } of summary) {
      const d = document.createElement("details");
      const s = document.createElement("summary");
      s.textContent = `${b}. ${BANKS[b]}: ${chosen} selected (${found} candidates${existing ? `, ${existing} already there` : ""})`;
      const ul = document.createElement("ul");
      for (const p of plan[b]) ul.append(Object.assign(document.createElement("li"), { textContent: p.name }));
      d.append(s, ul);
      box.append(d);
    }
  }

  $("go").onclick = run;
  refresh();
})();
