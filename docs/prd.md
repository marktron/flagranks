---
source: "https://chatgpt.com/c/6969779c-516c-832b-ab4d-f2bd2162bb3c"
author:
  - "ChatGPT"
published:
created: 2026-01-15
description: "FlagRanks is a lightweight web game where anonymous users repeatedly pick which of two UN-member national flags is “better designed,” immediately seeing community vote splits and moving to the next pairing; a global leaderboard ranks flags by a Bayesian-smoothed win percentage. The PRD specifies the MVP scope (hide country names pre-vote, fast vote→reveal loop), UX and visual style (soft/playful brutalism), matchmaking and ranking algorithms, minimal data model and backend, anti-abuse measures, analytics, and a short launch plan."
tags:
---
## PRD: FlagRanks

**Status:** v0.2
**Owner:** Mark  
**Scope:** MVP polish + launch (1–2 weeks)

---

### 1) Problem / opportunity

FlagRanks is a lightweight, “oddly addictive” micro-game: users vote on which of two randomly presented UN-member national flags is **better designed**, immediately see how others voted, then get the next pairing. A global leaderboard ranks flags by (smoothed) winning percentage.

This is intentionally a toy: the primary risk is lack of monetization and novelty fade.

---

### 2) Goals / non-goals

**Goals**

- **Zero-friction**: no sign-in required to play.
- **Fast loop**: vote → reveal consensus → next pairing with minimal latency.
- **Aesthetic framing**: prompt focuses on design, not geopolitics.
- **Shareability (lightweight)**: copy-link sharing for matchups and leaderboard.

**Non-goals (MVP)**

- Accounts, profiles, comments, social graph.
- Regional/demographic breakdowns.
- Serious anti-cheat / “scientific” validity.
- Monetization.

---

### 3) Decisions locked in

- **Flag set:** UN members only.
- **Prompt framing:** “better designed” (avoid “how do you feel about this country”).
- **Name visibility:** default **hide country names until after vote**.
- **Leaderboard metric:****smoothed win%** (Bayesian smoothing), with games played visible.
- **Sharing:** copy link is sufficient.
- **Backend:** tiny/minimal.
- **Integrity:** “good enough” protections.

---

### 4) Users / use cases

**Primary user:** casual web user who enjoys simple, addictive ranking games.  
**Secondary user:** vexillology enthusiasts.

**Core loop**

1. See two flags (no names).
2. Vote on “better designed”.
3. See consensus split + reveal names.
4. Next pairing.

---

### 5) UX requirements

#### 5.1 Voting screen

- Two large flag cards (tap/click target ≥ 44px).
- Prompt copy (example): **“Which flag is better designed?”**
- **Country names hidden pre-vote**:
	- Display: no text labels (or generic “Left / Right”).
	- After vote: reveal full country names + stats.

**Interaction**

- Click/tap card = cast vote.
- Keyboard: ← / → to vote.
- Optional: `S` to skip (nice-to-have; not required).

#### 5.2 Post-vote reveal (reward moment)

Show:

- “You picked: \[Country\]” (small, not preachy).
- Pairing split: “Chile 55% vs Sweden 45%”
- Sample size for the pairing: `n = …` (must be visible to avoid “made up %” vibe).
- CTA: **Next** (or auto-advance after ~600–900ms with “Undo” removed; keep loop tight).

#### 5.3 Leaderboard

- Ranked list by **smoothed win%**.
- Columns: rank, flag thumbnail, country name, **score**, raw win%, games played.
- Default sort: smoothed score.
- Guardrail: visually de-emphasize extremely low-sample flags (but smoothing should already help).

#### 5.4 Flag detail page (MVP-lite)

- Big flag.
- Smoothed score + raw win% + games played.
- Recent matchups (last ~10) and/or top wins/losses (optional; only if cheap).

#### 5.5 Accessibility note (important tradeoff)

Hiding country names pre-vote makes the experience less accessible for screen-reader users. MVP recommendation:

- Default: names hidden visually.
- Provide a simple toggle: **“Show names while voting”** (stored locally).  
	This keeps your core intent while not fully excluding assistive tech users.

---

### 6) Stats + ranking spec

#### 6.1 Leaderboard score (display)

Use Bayesian smoothing with a neutral prior:

$$
score = \frac{wins + k \cdot 0.5}{games + k}
$$
- Default `k = 10` (tunable).
- Display:
	- **Smoothed score** (primary)
	- **Raw win%** (secondary)
	- **Games** (prominent)

#### 6.2 Pairing result (%)

For a given unordered pair (A,B):

- track `votes_for_A`, `votes_for_B`, `n_total`
- display `A% = votes_for_A / n_total`, `B% = …`
- If `n_total` is very small (e.g., < 30), optionally show “Early result” badge.

---

### 7) Matchmaking / pairing generation

Constraints:

- Must feel random.
- Avoid repeating the same matchup too often per session.
- Ensure under-sampled flags get shown.

MVP algorithm:

1. Choose `flag_a` from the **bottom quartile by games played** (exploration).
2. Choose `flag_b` randomly from all other flags.
3. Reject if the user has seen that unordered pair in last `N=25` pairings (client-side memory).
4. Return the pair.

This is “good enough” and keeps implementation small.

---

### 8) Anti-abuse (“good enough”)

- Rate limit per IP (or per ephemeral session cookie): e.g., 1 vote/sec sustained, burst 5.
- Deduplicate exact same pairing vote from same session within a short window (e.g., 10 minutes).
- If cadence is inhuman (e.g., consistent sub-150ms voting), silently ignore or down-weight.

No CAPTCHA in MVP unless you see obvious bot traffic.

---

### 9) Visual design system (soft / playful brutalism, neutral chrome)

**Intent:** flags are the star; UI provides structure and delight without competing.

**Key traits (from your reference image, but toned down)**

- Warm neutral background (paper-like).
- Subtle grid texture (very low contrast).
- Thick-ish outlines, rounded rectangles, “sticker card” composition.
- Big, friendly type; simple iconography; asterisk/star as a signature accent.
- Minimal accent color usage (1 accent max) so flags remain dominant.

#### 9.1 Color tokens (proposed)

- Use Tailwind's "stone" color family, with tailwind "cyan" as an accent.

**Rule:** never theme components with multiple bright colors; results bars should be neutral (outline + fill density), not rainbow.

#### 9.2 Components

- **FlagCard**
	- neutral surface, bold outline, soft shadow
	- subtle hover lift
	- no colored backgrounds (let flag provide color)
- **ResultBar**
	- two neutral bars with labels; winner indicated by outline weight / icon, not bright fill
- **Buttons**
	- pill/rounded, outlined, minimal fill
- **Texture**
	- optional grid overlay at 2–4% opacity

---

### 10) Architecture (tiny backend)

Goal: static frontend + thin API.

**Recommended default**

- **Frontend:** Vercel, tailwind & shadcn/ui for components
- **Backend:** serverless function/worker + lightweight SQL store.

Concrete option that stays “tiny”:

- **Cloudflare Worker + D1 (SQLite)** for votes + stats.
- Cache leaderboard responses at edge (KV or in-worker cache) with short TTL (e.g., 30–120s).

**API endpoints (MVP)**

- `GET /api/matchup`
	- returns: `{ a: {id, svgUrl}, b: {id, svgUrl}, matchupId }`
	- (names optionally omitted until vote)
- `POST /api/vote`
	- body: `{ matchupId, winnerId, loserId }`
	- returns: `{ pairing: {aName, bName, aPct, bPct, n}, updated: {winnerScore, loserScore} }`
- `GET /api/leaderboard?limit=200`
- `GET /api/flags/:id`

---

### 11) Data model (minimal)

**flags**

- `id` (int)
- `country_name`
- `iso2`
- `svg_url`
- `is_active`

**pairings** (optional; can be computed via ordered ids)

- `id` (text) — e.g., `"minId-maxId"`
- `a_id`, `b_id`

**votes\_agg\_pairings**

- `pairing_id`
- `a_votes`
- `b_votes`
- `n_total`
- `updated_at`

**flag\_stats**

- `flag_id`
- `wins`
- `losses`
- `games`
- `smoothed_score`
- `updated_at`

MVP vote storage can be aggregate-only (no raw vote rows) if you truly want minimal. If you want auditability later, store raw votes with a short retention window.

---

### 12) Analytics (must-have)

Events:

- `session_start`
- `matchup_view`
- `vote_cast` (include latency)
- `results_view`
- `leaderboard_view`
- `share_copy`

Primary KPIs (from your brief): traffic, session duration, virality/share rate.

---

### 13) MVP checklist

**Must ship**

- Voting loop (name hidden pre-vote, reveal post-vote)
- Pairing % + n display
- Smoothed leaderboard
- Copy-link sharing (matchup + leaderboard)
- Tiny backend + rate limiting
- Basic responsive + keyboard support
- Seeded UN-member flag set

**Explicitly not shipping**

- Accounts
- Rich social
- Serious anti-cheat
- Monetization

---

### 14) Open questions (non-blocking, but will affect build details)

1. **Flag asset source + licensing posture:** do you want to vendor SVGs into the repo (fastest + safest), or fetch from a CDN?
	1. Claude: Do some research and present me with good options on an SVG flag library I can bring into the repo. I want flags at their actual aspect ratios, not cropped to a 4:3 aspect ratio.
2. **Name hiding strictness:** should names also be hidden in the HTML/ARIA pre-vote (more aligned with intent, less accessible), or visible to screen readers via toggle?
	1. Answer: hidden
3. **Share URLs:** do you want share links to encode a specific matchup (so others land on that matchup’s result), or just link to the home page with a lightweight preview?
	1. Answer: Just link to the home page