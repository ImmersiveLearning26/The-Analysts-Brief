# Content, rules and discrepancy register

Source: `source/Original_SDD.pdf`, 24 pages. Machine-readable transcription: `app/content.mjs` and `production/content.json`. Exact executable rules: `app/engine.mjs`. The SDD is included for the full real-world record and contextual explanations.

## Preserve the educational system
S1: 16 evidence pieces and 2 claims. The latest design replaces jigsaw dragging with tag selection, and both tags file back into the same folder. Open case notes when at least 14 of the 16 sourced pieces are tagged Foundations and both claims are classified. Strong if both claims are set aside; Mixed if one is retained; Fragile if both retained. The original threshold is not changed to “all correct”. Offer revision for mistakenly set-aside reliable evidence so the threshold cannot dead-end.

S2: seven binary factors. All source deltas and first-match outcome rules are implemented verbatim. There are 128 combinations; F7 changes no points. All runs are stored. The five dated headlines remain navigable, not an autoplay reading test. Findings select 1–3 factors and a nonempty sentence. One reminder is shown if no model test was run; proceeding is allowed. The source rubric grades selected factors, not the free text or test count.

S2 strand: Strong = F2 and at least one of F3/F6, excluding F7. Fragile = no F2 and neither F3 nor F6. Otherwise Mixed. Climate = Calm if neither S1 nor S2 Fragile; Strained if one; Hostile if both. No numeric grade on the screen.

S3: five levers, three options each. Keep IDs stable when the visual order is randomized once per session. Budget is 9 Calm / 8 Strained / 7 Hostile. Cost over budget applies −2 to public confidence and −2 to tension easing. It is a consequence, not a prohibited combination. Low/Rising <= −1; Medium/Steady 0–2; High/Easing >=3. Strong no adverse indicator, Mixed one, Fragile at least two. All 243 combinations resolve in every climate. All five choices and a nonempty rationale are required to submit. A test is encouraged, but the original submit rule does not require a prior test. Recompute from submitted choices so an old test cannot determine a revised plan.

S4: typed or audio briefing. Four topic indicators are formative keyword checks and MUST say “not yet detected” rather than “missing” or “incorrect”. No numeric score, no AI judgement of free text. Audio without a transcript receives “check unavailable”; it can still be submitted. Ask consent before recording; cloud retention requires a separate explicit production consent. Briefing does not change the three strands.

Forward view counts Strong strands: 3 → F1; 2 → F2; 0–1 → F3. Weak outcomes still finish. No pass/fail or leaderboard.

## Discrepancies to make visible to the builder
1. **Worked S3 example inconsistency (source p23):** it names L5-2 but uses L5-1’s cost and indicator deltas. Use the formal option table and resolution rule (pp15–16), not that arithmetic example. The test suite checks both variants. Do not change IDs to conceal the mismatch.
2. **Generic outcome headlines:** “One party declared” can appear in an outcome bucket even when F3 was switched. Preserve source sets in this handoff; request SME content review before rewriting dynamically. Do not claim each headline proves the selected factor caused that exact event.
3. **Findings feedback:** source says “your tests back this up”, but the rule only uses chosen factors. Preserve the rubric; do not secretly add test-history scoring. Flag this wording for SME review, particularly the permitted no-run route.
4. **Source scene-count sentence is inconsistent:** the SDD describes four substantive nodes S1–S4 despite the metadata’s “two simulation beats” wording. The explicit nodes are implemented. Fifteen view states are not fifteen new activities.
5. **Nana’s provenance wording:** the table labels piece 5 as an oral history recorded in 1958 (Nana’s grandmother); the transcript is Nana quoting her grandmother. Preserve both in the evidence metadata and transcript, and do not invent a new recording date.
6. **User-approved design change:** tag selection replaces jigsaw/trays; this changes the motor interaction, not evidence classifications or scoring.
7. **Source original wording vs compact summaries:** all evidence cards use source text. Generated images use shorter illustrative copy. Do not copy abbreviated image text over the content file.
8. **No claimed real forecasts:** the miniature and hall indicators are teaching models. Do not output probabilities, claim the AI predicts a real country, or assign inherent traits to communities.

## Live AI boundary
The orb can be entirely scripted. Explicit selectable factors and options are the reliable baseline. Optional natural-language interpretation may only propose a validated list of allowed IDs and display the exact base→alternative change for confirmation. It cannot change scoring tables, mutate state before confirmation, invent factors, write findings for the learner, or grade the rationale. Unsupported requests yield “Choose one of these conditions” with the canonical options. Provider errors must fall back to those controls. No API keys in browser code. No provider is connected in this kit.
