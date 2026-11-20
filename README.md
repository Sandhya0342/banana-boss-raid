# 🍌 Banana Boss Raid

**University of Bedfordshire**  
**Unit:** CIS046-3 Software For Enterprise  
**Author:** Sandhya Ghale  
**Application Type:** Full-Stack Cooperative Browser-Based Puzzle Game  

---

## 🌟 1. Project Overview

**Banana Boss Raid** is a vibrant, banana-themed cooperative web game where players register accounts, solve randomized mathematical ciphers retrieved from the external **Banana API**, earn reward points, and band together to defeat a shared raid boss in real-time.

The application is built using a decoupled **client-server enterprise architecture**:
- **Frontend:** Semantic HTML5, Modular CSS3, and Vanilla JavaScript (No heavy frameworks).
- **Backend:** Node.js with Express.js REST API server.
- **Database:** SQLite (using Node.js native `node:sqlite`) with Write-Ahead Logging (WAL) and persistent session storage.
- **External API:** Official Banana Game API (Dr. Marc Conrad, University of Bedfordshire).

---

## 🎓 2. University Assignment Themes

This project demonstrates all four core themes of the CIS046-3 unit:

### Theme A: Version Control
- **Git & GitHub Workflow:** Structured repository with a dedicated `main` branch (production-ready code) and `develop` branch (active staging).
- **Modularity:** Separation of concerns into distinct directories (`controllers`, `routes`, `models`, `services`, `events`, `public`, `tests`).
- **Maintainability:** Git allows safe experimentation, branch-based feature delivery, clear commit histories, and team collaboration.

### Theme B: Event-Driven Programming
- **Client-Side Events:** Interactive DOM event listeners for form submissions, keyboard inputs, keypad clicks, and animated health-bar transitions.
- **REST Polling Timers:** Periodic timers (`setInterval` every 3 seconds) synchronize the shared boss health and combat feeds across multiple player sessions.
- **Server-Side Node.js `EventEmitter`:** Implemented in `src/events/gameEvents.js`. Emits and listens for critical game lifecycle events:
  - `user:registered` & `user:login`
  - `puzzle:requested`, `puzzle:solved`, and `puzzle:failed`
  - `boss:attacked`, `boss:defeated`, and `boss:reset`

### Theme C: Interoperability
- **Official Banana API Integration:** Connects directly to `https://marcconrad.com/uob/banana/api.php?out=json`.
- **Reference Documentation:** [https://marcconrad.com/uob/banana/doc.php](https://marcconrad.com/uob/banana/doc.php).
- **Decoupled Backend Service:** Handled exclusively inside `src/services/bananaApiService.js`. The browser never communicates directly with the third-party endpoint.
- **Security:** The puzzle solution is kept strictly on the server in SQLite and is **never** sent to the client browser.
- **Resilience:** Features an `AbortController` timeout (7s) and an automated procedural SVG fallback engine to ensure offline grading and testing even during API downtime.

### Theme D: Virtual Identity
- **User Authentication:** Registration and login interfaces with client- and server-side validation.
- **Password Security:** Passwords hashed with salt using `bcryptjs` (Cost factor 10). Plain-text passwords are never stored or logged.
- **Persistent Sessions:** Configured with `express-session` backed by a custom `SqliteSessionStore`. User sessions survive server restarts.
- **Cookie Hardening:** `httpOnly: true`, `sameSite: 'lax'`, and configurable HTTPS flags.
- **Protected Routes:** `requireAuth` middleware restricts puzzle requests and boss attacks to verified accounts.

---

## 🕹️ 3. Game Features

1. **User Authentication & Dashboard:**
   - Account creation (Username, Email, Password, Password Confirmation).
   - Secure login and persistent session state.
   - Player Dashboard displaying Total Score, Puzzles Solved, Boss Damage Dealt, and Available Attack Charges.

2. **Banana API Puzzle Cipher:**
   - Displays real-time graphical math equations from the Banana API.
   - Dual input: on-screen 0–9 arcade keypad or physical keyboard.
   - Server-side answer validation awarding 10 points and 1 Boss Attack Charge upon correct solution.
   - Prevents repeated submission of already solved or failed puzzle sessions.

3. **Cooperative Boss Raid Arena:**
   - Multi-player shared boss battle against "King Mecha-Banana" (500 HP).
   - Players consume earned attack charges to deal 25 damage (with a 25% chance of a 50 DMG Critical Strike!).
   - Concurrency-safe atomic database transactions (`BEGIN IMMEDIATE`) prevent race conditions.
   - Floating combat damage numbers and shake animations on strike.
   - Dynamic health bar color transitions (Green → Yellow → Red).
   - Live Raid Activity Feed and Top Contributors Leaderboard synced every 3 seconds.
   - Victory banner and "Spawn Next Boss Raid" button when the boss reaches 0 HP.

4. **Global Leaderboard:**
   - Podium display for the Top 3 players (Gold, Silver, Bronze badges).
   - Comprehensive rankings table sorted by Total Score, Boss Damage, and Puzzles Solved.

5. **Arcade UI/UX:**
   - Custom banana-yellow (`#ffcc00`) and cyber-purple (`#1a0c30`) color palette.
   - Responsive design for desktop, tablet, and mobile browsers.
   - Original vector SVG artwork for the boss and banana coin.

---

## 📁 4. Project Directory Structure

```
Banana Boss Raid/
├── .gitignore                     # Git ignore rules for node_modules, env, and DB
├── package.json                   # Project metadata, scripts, and dependencies
├── package-lock.json              # Dependency lockfile
├── README.md                      # Academic documentation and setup guide
├── NOTES.md                       # Architectural Decision Records & Video guide
├── .env.example                   # Template environment variables
├── .env                           # Local environment configuration
├── database/
│   ├── .gitkeep                   # Tracks directory in Git
│   └── banana_boss.db             # Persistent SQLite database (generated at runtime)
├── src/
│   ├── server.js                  # Main Express HTTP server & route configuration
│   ├── config/
│   │   └── database.js            # SQLite connection (node:sqlite) & Session Store
│   ├── events/
│   │   └── gameEvents.js          # Node.js EventEmitter game lifecycle hub
│   ├── middleware/
│   │   └── authMiddleware.js      # Protected route session authorization
│   ├── models/
│   │   ├── userModel.js           # User database queries & bcrypt verification
│   │   ├── playerModel.js         # Player scoring, stats, and leaderboard queries
│   │   └── bossModel.js           # Atomic transactional boss battle calculations
│   ├── services/
│   │   └── bananaApiService.js    # External Banana API integration & answer validation
│   ├── controllers/
│   │   ├── authController.js      # Registration, login, logout, profile handlers
│   │   ├── puzzleController.js    # Puzzle generation & answer verification handlers
│   │   ├── bossController.js      # Boss state polling, attack & reset handlers
│   │   └── leaderboardController.js # Ranked player leaderboard handler
│   └── routes/
│       ├── authRoutes.js          # /api/auth routes
│       ├── puzzleRoutes.js        # /api/puzzle routes
│       ├── bossRoutes.js          # /api/boss routes
│       └── leaderboardRoutes.js   # /api/leaderboard routes
├── public/
│   ├── index.html                 # Single-page application markup & modals
│   ├── css/
│   │   └── styles.css             # Arcade visual styles, responsive grid & animations
│   ├── js/
│   │   ├── app.js                 # Global SPA routing, toasts & state coordinator
│   │   ├── auth.js                # Login, registration, session management
│   │   ├── puzzle.js              # Puzzle fetching, keypad & answer submission
│   │   ├── boss.js                # Boss REST polling, attacks & animations
│   │   └── leaderboard.js         # Rankings retrieval & podium rendering
│   └── assets/
│       ├── boss.svg               # Original SVG vector artwork for King Mecha-Banana
│       └── banana-coin.svg        # Original SVG vector artwork for Banana Coin
└── tests/
    ├── testSuite.js               # Unit and architectural theme tests (10 tests)
    ├── integrationTest.js         # End-to-end HTTP REST API tests (12 tests)
    └── runAll.js                  # Master test runner
```

---

## ⚙️ 5. Installation & Setup Instructions

### Prerequisites
- **Node.js**: v18.0.0 or higher (Tested and certified on Node.js v26.13.1).
- **npm**: v9.0.0 or higher (Installed with Node.js).
- **Git**: Installed and configured.

### Step 1: Install Dependencies
Open your terminal in the project root folder and execute:
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` (a ready-to-run `.env` is already provided):
```bash
cp .env.example .env
```

### Step 3: Run the Automated Tests
Verify all 10 unit tests and 12 integration tests:
```bash
# Run master test suite
npm test

# Run individual suites
npm run test:unit
npm run test:integration
```

### Step 4: Start the Web Server
```bash
npm start
```
For automatic file-watching during development:
```bash
npm run dev
```

### Step 5: Open in Your Browser
Navigate to:
```
http://localhost:3000
```

---

## 🔒 6. Security & Best Practices

- **Zero Plaintext Passwords:** Handled via `bcryptjs` with cryptographically secure salts.
- **SQL Injection Prevention:** 100% of queries use parameterised statements (`?` placeholders).
- **Solution Concealment:** The puzzle solution is never transmitted across the network to the browser.
- **Attack Authentication:** Users cannot attack the boss without consuming a validated solved puzzle stored in their session.
- **Session Security:** SQLite persistent session store ensures cookies cannot be forged or tampered with on the client.

---

## 📜 7. Academic Integrity & Acknowledgements

- **Banana API:** Created and hosted by **Dr. Marc Conrad**, University of Bedfordshire ([Banana API Documentation](https://marcconrad.com/uob/banana/doc.php)).
- **Generative AI Declaration:** In compliance with University of Bedfordshire academic policy, portions of the codebase, project scaffolding, and architectural patterns were developed with AI assistance (Google DeepMind Antigravity). All design choices, code structures, and documentation have been reviewed, tested, and understood by the student.
