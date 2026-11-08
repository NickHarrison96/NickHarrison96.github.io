
    import { TOOLS } from './catalog.js';

    // ── Self-hosted origin ────────────────────────────────────────────────
    // This URL is SAFE TO COMMIT: it is the Cloudflare Worker's address and
    // carries no secret. The Worker holds the access token in an encrypted
    // secret and injects it server-side on every upstream request, so nothing
    // sensitive exists in this file or in this repository's history.
    //
    // NEVER put a raw origin (a tunnel or container address) plus a token in
    // here. That combination was committed once and published the whole host
    // folder to anyone who read the page source; the token had to be rotated.
    //
    // The Worker needs no authentication, so downloads are open to anyone who
    // can reach it. To restrict that, put Cloudflare Access in front of the
    // Worker rather than adding auth to downloads.html — see
    // ~/Documents/Github/selfhost/worker/README.md.
    const SELF_HOST_API = "https://harrisontechdev.harrisontechdev.workers.dev";

    // A local origin (which does need a token) can be supplied by setting
    // window.SELF_HOST_API_OVERRIDE in selfhost.local.js, which is gitignored.
    // It wins when present, so the committed value above stays token-free.
    const SELF_HOST_BASE = (typeof window !== "undefined" && window.SELF_HOST_API_OVERRIDE)
      || SELF_HOST_API;
    const HEALTH_INTERVAL_MS = 30000;
    const HOST_LIST_INTERVAL_MS = 60000;

    // The catalog lives in assets/js/catalog.js (shared with the homepage).
    // Add tools there, not here.

    const DL_ICON = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>';
    const CHEVRON = '<svg aria-hidden="true" class="dl-chevron" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>';
    const TOOL_ICON = '<svg aria-hidden="true" class="dl-thumb-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26" /></svg>';

    const fmtBytes = (b) => {
      if (b === null || b === undefined) return "";
      const u = ["B", "KB", "MB", "GB", "TB"];
      let i = 0, n = b;
      while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
      return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
    };
    const timeoutSignal = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
    const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const tileBg = (h) => `linear-gradient(135deg, hsl(${h} 68% 42%) 0%, hsl(${(h + 46) % 360} 62% 30%) 100%)`;

    function cardHtml(d, enabled) {
      const isGh = d.host === "github";
      const soon = d.status === "soon" || (isGh && !d.url);
      const canDownload = !soon && (isGh || enabled);
      const href = isGh
        ? (d.url || "#")
        : `${SELF_HOST_BASE}/api/files/${encodeURIComponent(d.filename || "")}`;
      const size = d.size ? fmtBytes(d.size) : "";
      const sha = d.sha256 ? `<code title="SHA-256">${esc(d.sha256).slice(0, 16)}&hellip;</code>` : "";

      const thumbInner = d.image
        ? `<span class="dl-host">${isGh ? "GitHub" : "Self-Hosted"}</span><img src="${esc(d.image)}" alt="${esc(d.name)}">`
        : `<span class="dl-host">${isGh ? "GitHub" : "Self-Hosted"}</span>${TOOL_ICON}`;
      const thumbStyle = d.image ? "" : ` style="background:${tileBg(d.hue || 210)}"`;

      let btnLabel, btnAttrs;
      if (soon) {
        btnLabel = "Coming Soon";
        btnAttrs = 'aria-disabled="true"';
      } else if (isGh) {
        const isFile = /\.(zip|exe|dmg|7z|tar\.gz|tgz|appimage|msi|pkg)$/i.test(d.url);
        btnLabel = `Download${size ? ` · ${size}` : ""}`;
        btnAttrs = isFile ? "download" : 'target="_blank" rel="noopener noreferrer"';
      } else {
        btnLabel = `Download${size ? ` · ${size}` : ""}`;
        btnAttrs = canDownload ? "download" : 'aria-disabled="true"';
      }

      const meta = (size || sha) ? `<div class="dl-meta2">${size ? `<span>${size}</span>` : ""}${sha}</div>` : "";

      return `
        <div class="dl-card">
          <button class="dl-head" aria-expanded="false">
            <div class="dl-thumb"${thumbStyle}>${thumbInner}</div>
            <div class="dl-info">
              <div class="dl-titlewrap">
                <span class="dl-name2">${esc(d.name)}</span>
                <span class="dl-sub2">${[d.version, d.category].filter(Boolean).map(esc).join(" · ")}</span>
              </div>
              ${CHEVRON}
            </div>
          </button>
          <div class="dl-reveal"><div><div class="dl-reveal-pad">
            <p class="dl-desc2">${esc(d.description)}</p>
            ${meta}
            <a class="btn-green" href="${href}" ${btnAttrs}>${DL_ICON} ${btnLabel}</a>
          </div></div></div>
        </div>`;
    }

    function wireExpand(container) {
      container.querySelectorAll(".dl-head").forEach((btn) => {
        btn.addEventListener("click", () => {
          const card = btn.closest(".dl-card");
          const open = card.classList.toggle("expanded");
          btn.setAttribute("aria-expanded", open ? "true" : "false");
        });
      });
    }

    const gh = TOOLS.filter((d) => d.host === "github");
    const self_ = TOOLS.filter((d) => d.host === "self");

    const ghSection = document.getElementById("ghSection");
    const ghGrid = document.getElementById("ghGrid");
    const selfSection = document.getElementById("selfSection");
    const selfGrid = document.getElementById("selfGrid");
    const emptyEl = document.getElementById("dlEmpty");
    const pill = document.getElementById("statusPill");
    const pillText = document.getElementById("statusText");

    // Self-hosted section — gated by the live status light
    function renderSelf(serverUp) {
      selfGrid.innerHTML = self_.map((d) => cardHtml(d, serverUp)).join("");
      wireExpand(selfGrid);
    }
    async function pingHealth() {
      try {
        const r = await fetch(`${SELF_HOST_BASE}/api/health`, { signal: timeoutSignal(5000), cache: "no-store" });
        if (!r.ok) throw new Error("bad status");
        pill.className = "status-pill up";
        pillText.textContent = "Online";
        return true;
      } catch {
        pill.className = "status-pill down";
        pillText.textContent = "Offline";
        return false;
      }
    }

    const CHEVRON_UP = '<svg aria-hidden="true" class="host-group-chev" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>';

    /* ── Host folder listing ──────────────────────────────────────
       Reads whatever is sitting in the host folder right now, so files can be
       added there without touching this catalog. Files sitting loose in the
       root render as plain rows; each subfolder becomes a collapsible group.
       The fetch is always attempted: if SELF_HOST_API is unreachable — which
       is what a deploy without a real tunnel origin looks like — the section
       says so plainly rather than pretending to be fine. */
    const hostSection = document.getElementById("hostSection");
    const hostBox = document.getElementById("hostBox");
    const hostEmpty = document.getElementById("hostEmpty");
    const hostNote = document.getElementById("hostNote");

    const hostIsLocal = /(^https?:\/\/)(127\.0\.0\.1|localhost)/i.test(SELF_HOST_BASE);
    const hostNoteSuffix = () => (hostIsLocal ? " · local test origin" : "");
    // An unconfigured SELF_HOST_API means the section has nothing to talk to.
    // Leave it hidden rather than showing a red dot and "unreachable", which
    // would read as an outage on a site that simply isn't using this feature.
    const hostConfigured = /^https?:\/\//i.test(SELF_HOST_BASE);

    function hostRowHtml(f, prefix) {
      // prefix is the already-encoded folder path from the root, so nested rows
      // build correct URLs without each level having to know its ancestors.
      const path = (prefix ? prefix + "/" : "") + encodeURIComponent(f.name);
      const href = `${SELF_HOST_BASE}/api/files/${path}`;
      const size = f.size ? fmtBytes(f.size) : "";
      return `
        <div class="host-row">
          <span class="host-name" title="${esc(decodeURIComponent(prefix ? prefix + "/" + f.name : f.name))}">${esc(f.name)}</span>
          <span class="host-size">${size}</span>
          <a class="host-dl" href="${href}" download>
            ${DL_ICON}
            Download
          </a>
        </div>`;
    }

    function hostGroupHtml(g, path) {
      // path is the already-encoded prefix from the root, so nested rows build
      // correct URLs without each level having to know its ancestors.
      const here = path ? path + "/" + encodeURIComponent(g.name) : encodeURIComponent(g.name);
      const total = hostCountBytes(g);
      const n = hostCountFiles(g);
      // files/dirs arrive as null from Go when a slice is empty, so normalise
      // before mapping — `(g.files || [])` is load-bearing, not defensive noise.
      return `
        <details class="host-group">
          <summary>
            <span class="host-group-name">${esc(g.name)}</span>
            <span class="host-group-count">${n} file${n === 1 ? "" : "s"} · ${fmtBytes(total)}</span>
            ${CHEVRON_UP}
          </summary>
          ${(g.files || []).map((f) => hostRowHtml(f, here)).join("")}
          ${(g.dirs || []).map((d) => hostGroupHtml(d, here)).join("")}
        </details>`;
    }

    const hostCountFiles = (g) =>
      (g.files || []).length + (g.dirs || []).reduce((n, d) => n + hostCountFiles(d), 0);

    const hostCountBytes = (g) =>
      (g.files || []).reduce((n, f) => n + (f.size || 0), 0) +
      (g.dirs || []).reduce((n, d) => n + hostCountBytes(d), 0);

    async function renderHost() {
      const dot = document.getElementById("hostDot");
      const setDot = (state) => {
        if (!dot) return;
        dot.className = "host-dot" + (state ? " " + state : "");
        dot.title = state === "up" ? "Host folder online" : state === "down" ? "Host folder offline" : "Checking host folder…";
      };

      setDot(null);
      hostNote.textContent = "Checking host folder…";
      try {
        const r = await fetch(`${SELF_HOST_BASE}/api/list`, { signal: timeoutSignal(15000), cache: "no-store" });
        if (!r.ok) throw new Error("bad status");
        const data = await r.json();
        // Tolerate both shapes so an older server doesn't blank the section.
        const loose = Array.isArray(data) ? data : (Array.isArray(data.loose) ? data.loose : null);
        const groups = Array.isArray(data) ? [] : (Array.isArray(data.groups) ? data.groups : null);
        if (!loose || !groups) throw new Error("bad payload");

        hostSection.hidden = false;
        hostEmpty.hidden = true;
        setDot("up");

        const html = loose.map((f) => hostRowHtml(f, null)).join("")
          + groups.map((g) => hostGroupHtml(g, null)).join("");
        if (!html) {
          hostBox.innerHTML = "";
          hostEmpty.textContent = "Nothing published in the host folder yet.";
          hostEmpty.hidden = false;
          hostNote.textContent = hostNoteSuffix().replace(" · ", "");
          return;
        }

        hostBox.innerHTML = html;
        // Open the first group by default so the section doesn't look inert,
        // but only on the initial load — a later refresh shouldn't yank an
        // open/closed choice the user made.
        if (!hostBox.dataset.touched) {
          const first = hostBox.querySelector(".host-group");
          if (first) first.open = true;
        }

        let count = loose.length;
        let bytes = loose.reduce((n, f) => n + (f.size || 0), 0);
        groups.forEach((g) => {
          count += hostCountFiles(g);
          bytes += hostCountBytes(g);
        });
        hostNote.textContent = `${count} file${count === 1 ? "" : "s"} · ${fmtBytes(bytes)}${hostNoteSuffix()}`;
      } catch {
        hostSection.hidden = false;
        hostBox.innerHTML = "";
        hostEmpty.hidden = false;
        hostEmpty.textContent = "Host folder unreachable.";
        hostNote.textContent = "Offline · GitHub downloads are still listed above.";
        setDot("down");
      }
    }

    // Remember that the user opened a group, so the auto-open-on-load above
    // stops interfering after the first interaction.
    document.addEventListener("toggle", (e) => {
      if (e.target && e.target.classList && e.target.classList.contains("host-group") && hostBox) {
        hostBox.dataset.touched = "1";
      }
    }, true);

    (async function init() {
      if (self_.length) {
        selfSection.hidden = false;
        const up = await pingHealth();
        renderSelf(up);
        setInterval(async () => { renderSelf(await pingHealth()); }, HEALTH_INTERVAL_MS);
      }
      if (!gh.length && !self_.length) emptyEl.hidden = false;
      if (hostConfigured) {
        await renderHost();
        setInterval(renderHost, HOST_LIST_INTERVAL_MS);
      }
    })();
  
 document.getElementById("hostRetry").addEventListener("click", renderHost);
