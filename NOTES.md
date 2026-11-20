# 📝 Development Notes & Assessment Reflection

**Project:** Banana Boss Raid  
**Unit:** CIS046-3 Software For Enterprise (University of Bedfordshire)  
**Student:** Sandhya Ghale  

---

## 🏛️ 1. Architectural Decision Records (ADRs)

### ADR 1: Choice of Database — SQLite (`node:sqlite`)
- **Context:** An enterprise web application requires a reliable relational database for storing virtual identities, persistent sessions, player scores, and boss raid states.
- **Decision:** Selected Node.js native `node:sqlite` (`DatabaseSync`) with Write-Ahead Logging (WAL) enabled (`PRAGMA journal_mode = WAL;`).
- **Rationale:**
  1. **Zero External Dependency Overhead:** In Node.js v22.5+, SQLite is compiled directly into the Node binary. It requires no separate database daemon (like MySQL or MongoDB) to install or configure.
  2. **Atomic Immediate Transactions:** Concurrent attacks from multiple players are wrapped in `BEGIN IMMEDIATE; ... COMMIT;`. This guarantees strict serialization, completely preventing race conditions and negative boss health.
  3. **Portability:** The entire database resides in a single portable file (`database/banana_boss.db`), allowing effortless grading and verification by university assessors.

---

### ADR 2: Multi-Player Synchronization — REST Polling vs WebSockets
- **Context:** Players need to see real-time updates of the shared boss's health and contributions.
- **Decision:** Implemented lightweight REST polling at a 3-second interval (`GET /api/boss/status`).
- **Rationale:**
  1. **Simplicity and Reliability:** WebSockets require persistent TCP state, heartbeat pings, reconnect fallbacks, and complex error handling across proxies or restrictive university networks.
  2. **Stateless HTTP Scalability:** Polling endpoints remain fully stateless. If a client drops offline or navigates between tabs, polling naturally pauses and resumes without connection drops.
  3. **Strict Concurrency Safety:** All state mutations (attacks) occur through explicit `POST /api/boss/attack` requests validated atomically on the server.

---

### ADR 3: Password Security — `bcryptjs`
- **Context:** Passwords must never be stored in plain text.
- **Decision:** Used `bcryptjs` with 10 salt rounds.
- **Rationale:**
  1. **Cross-Platform Compatibility:** Native `bcrypt` relies on `node-gyp`, Python, and Visual Studio C++ compilers on Windows, which frequently fail during build steps on student laptops. `bcryptjs` is pure JavaScript, completely portable, and yields identical cryptographic security.
  2. **Adaptive Work Factor:** 10 rounds provides strong protection against rainbow tables and brute-force attacks while maintaining fast server response times (~60ms).

---

### ADR 4: Interoperability Architecture — Decoupled Service Layer
- **Context:** The application integrates Dr. Marc Conrad's external Banana API.
- **Decision:** All communication with `https://marcconrad.com/uob/banana/api.php` is strictly isolated within `src/services/bananaApiService.js`.
- **Rationale:**
  1. **Concealment of Solutions:** The external API returns both `{ question, solution }`. If called directly from the browser, any student or user could inspect the network tab and cheat. The backend service intercepts the response, saves the solution in SQLite under a session token, and delivers **only** the image to the browser.
  2. **Fault Tolerance:** If the university host is down, times out (handled with `AbortController`), or returns malformed data, the service activates an in-memory procedural math puzzle generator so the game never crashes.

---

### ADR 5: Frontend Architecture — Vanilla JavaScript & CSS3
- **Context:** Choosing between frontend frameworks (React, Angular, Vue) or vanilla web standards.
- **Decision:** Vanilla HTML5, CSS3, and ES6 JavaScript.
- **Rationale:**
  1. **Academic Clarity:** Avoids complex bundlers (Webpack, Vite), node compilation layers, and transpilation abstractions. Assessors can directly read every line of DOM event handling and state management.
  2. **Instant Loading:** Zero framework bundle payload leads to sub-millisecond initial render times.

---

## 🔀 2. Version Control Reflection (Theme A)

### How Version Control Supports Enterprise Development
1. **Modularity & Traceability:**
   Version control decouples large projects into incremental, reviewable changes. Each feature (Authentication, Puzzle System, Boss Raid, Leaderboard) is isolated into separate branches before merging into `main`.
2. **Safety & Rollback:**
   If a bug or breaking change is introduced, Git allows developers to inspect the exact `git diff`, identify offending commits, and revert state without losing history.
3. **Collaboration:**
   In enterprise environments, multiple engineers work on parallel features without code collisions using branches (`develop`, `feature/*`) and pull requests.

### Branch Strategy Implemented:
- `main`: Production-stable release branch.
- `develop`: Staging and active feature branch.

---

## 🎥 3. Personal Assessment Video Demonstration Guide

*(Use these talking points when recording your own voice and screen for the assessment video):*

### Step 1: Introduction & Version Control (1–2 minutes)
- Introduce yourself and the unit: *"CIS046-3 Software For Enterprise, Banana Boss Raid."*
- Show your terminal:
  - Run `git status` and `git branch -a` to show the clean branch structure (`main` and `develop`).
  - Show `package.json` and explain the modular directory structure (`controllers`, `models`, `services`, `routes`).

### Step 2: Virtual Identity & Security (2 minutes)
- Open browser at `http://localhost:3000`.
- Click **Sign In / Register** and open the Registration tab.
- Demonstrate validation (e.g. mismatched passwords, invalid username).
- Register a new player account (e.g., `HeroPlayer`).
- Show the persistent session: refresh the browser or restart the server in terminal — your session remains active because it is saved in SQLite!
- Open SQLite database viewer or show `database/banana_boss.db` to show that the password is a `$2a$` bcrypt hash, never plain text.

### Step 3: Interoperability with the Banana API (2–3 minutes)
- Click **Solve Puzzles**.
- Explain: *"This image is fetched directly from Dr. Marc Conrad's official Banana API endpoint."*
- Open Browser Developer Tools (`F12`), go to the **Network** tab, and click **Next Puzzle**.
- Inspect the `/api/puzzle/new` response. Point out to the examiner: *"Notice that the JSON payload contains only `puzzleId` and the image URL `question`. The correct answer is never exposed to the client."*
- Solve the equation, input the answer, and click **Submit Answer**.
- Show the green banner: *"Correct! Earned 10 points and unlocked 1 Attack Charge!"*

### Step 4: Event-Driven Cooperative Boss Raid (2–3 minutes)
- Navigate to the **Boss Raid** tab.
- Explain the cooperative premise: *"All players share the same boss health pool."*
- Open a second browser window (e.g., Incognito) and log in with a second user account.
- In Window 1, click **Strike Boss (-25 HP)**.
- Observe:
  1. The boss shakes and floating damage text appears.
  2. In Window 2, within 3 seconds, the health bar automatically updates via REST polling.
  3. The Live Raid Feed and Contributor Table update in both windows!
- Point out terminal logs: show the Node.js `EventEmitter` logs (`[Event: BOSS_ATTACKED]`).

### Step 5: Leaderboard & Conclusion (1 minute)
- Click **Leaderboard** to show the dynamic Top 3 podium and sorted table.
- Run `npm test` in the terminal to demonstrate that all 10 unit tests and 12 integration tests pass.
- Conclude with a summary of the 4 themes.
