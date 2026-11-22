// Tap-to-define glossary (fix plan, Phase 1, step 4). Each term is marked where it first appears in a block of text;
// tapping it opens a one-sentence definition right beside the word. Plain text glosses, placed beside the word, had
// the strongest effects in the glossing meta-analyses; the words are kept conversational, as PhET's help advice says.
//
// DRAFT DEFINITIONS: written for B1-level English readers and still to be approved by the subject expert.
// Change the wording here only; nothing else depends on it.

export const OUTCOME_MEANING = {
  "Coup": "The army took power by force and removed the government.",
  "Personalised rule": "One leader holds power personally, and the rules no longer limit him.",
  "Consolidation": "Democracy settled: elections, institutions and handovers of power kept working.",
  "Instability": "Repeated unrest and changes of government, with no steady direction.",
  "Struggling rule": "The government kept power but struggled to deliver, mostly because the economy was weak.",
};

export const FACTOR_MEANING = {
  F1: "Who led the push for independence, and how widely it reached.",
  F2: "Who controls the army, and how soldiers are recruited.",
  F3: "How many political parties may exist and compete for power.",
  F4: "What the country earns its living from, and who benefits.",
  F5: "How power and resources are shared between the regions.",
  F6: "How power passes from one leader to the next.",
  F7: "How many communities make up the country.",
};

const TERMS = [
  ["Foundations", /\bFoundations\b/, "The sources you trust enough to build the background on, because a reliable source backs them up."],
  ["Set aside", /\bset aside\b/i, "Sources you do not use, because no one can back up what they claim."],
  ["Claim", /\bclaims?\b/i, "A statement someone makes. It may or may not be true until evidence supports it."],
  ["Source", /\bsources?\b/i, "Where a piece of information comes from, such as a census, a map, a report or a newspaper."],
  ["Coup", /\bcoup\b/i, OUTCOME_MEANING["Coup"]],
  ["Personalised rule", /\bpersonalised rule\b/i, OUTCOME_MEANING["Personalised rule"]],
  ["Consolidation", /\bconsolidation\b/i, OUTCOME_MEANING["Consolidation"]],
  ["Instability", /\binstability\b/i, OUTCOME_MEANING["Instability"]],
  ["Struggling rule", /\bstruggling rule\b/i, OUTCOME_MEANING["Struggling rule"]],
  ["Succession", /\bsuccession\b/i, FACTOR_MEANING.F6],
  ["Party system", /\bparty system\b/i, FACTOR_MEANING.F3],
  ["Civilian oversight", /\bcivilian oversight\b/i, "Elected leaders and public institutions control the army, not the other way round."],
  ["Units of time", /\bunits of time\b/i, "The Commission's working time. Each response option uses some, and the whole package must fit the budget."],
  ["The Dialogue", /\bthe Dialogue\b/, "The National Dialogue: the public meeting where the Commission and the people agree a way forward."],
];

const SKIP = "button, a, input, textarea, select, label, svg, .gloss, .who, .kicker, [aria-hidden='true'], script, style";

/** Mark the first appearance of each term inside `root`. Safe to call again: marked words are skipped. */
export function glossify(root) {
  if (!root) return;
  const used = new Set([...root.querySelectorAll(".gloss")].map((b) => b.dataset.term));
  for (const [name, re, def] of TERMS) {
    if (used.has(name)) continue;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let n, m;
    while ((n = walker.nextNode())) { m = re.exec(n.textContent); if (m) break; }
    if (!m) continue;
    const after = n.splitText(m.index); after.splitText(m[0].length);
    const b = document.createElement("button");
    b.type = "button"; b.className = "gloss"; b.dataset.term = name; b.dataset.def = def;
    b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-controls", "glossPop");
    b.textContent = after.textContent; after.replaceWith(b);
    used.add(name);
  }
}

// One shared popover, placed right beside the tapped word.
let pop = null, openBtn = null;
function close() {
  if (!pop || pop.hidden) return;
  pop.hidden = true; openBtn?.setAttribute("aria-expanded", "false"); openBtn = null;
}
function open(btn) {
  if (!pop) {
    pop = document.createElement("div"); pop.id = "glossPop"; pop.setAttribute("role", "note"); pop.hidden = true;
    document.body.append(pop);
  }
  if (openBtn === btn) { close(); return; }
  close();
  pop.innerHTML = ""; const t = document.createElement("strong"); t.textContent = btn.dataset.term;
  const d = document.createElement("span"); d.textContent = " " + btn.dataset.def; pop.append(t, d);
  pop.hidden = false; openBtn = btn; btn.setAttribute("aria-expanded", "true");
  const r = btn.getBoundingClientRect(), w = Math.min(300, innerWidth - 24);
  pop.style.width = w + "px";
  const left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2));
  const below = r.bottom + 8 + pop.offsetHeight < innerHeight - 8;
  pop.style.left = left + "px"; pop.style.top = (below ? r.bottom + 8 : r.top - 8 - pop.offsetHeight) + "px";
}
document.addEventListener("click", (e) => {
  const b = e.target.closest?.(".gloss");
  if (b) { e.preventDefault(); e.stopPropagation(); open(b); return; }
  if (pop && !pop.hidden && !pop.contains(e.target)) close();
}, true);
addEventListener("keydown", (e) => { if (e.key === "Escape" && pop && !pop.hidden) { e.stopPropagation(); const b = openBtn; close(); b?.focus(); } }, true);
addEventListener("scroll", close, true);
addEventListener("resize", close);
