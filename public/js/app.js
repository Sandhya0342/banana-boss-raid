/**
 * ============================================================================
 * Banana Boss Raid - Core Frontend Application Controller (app.js)
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise (University of Bedfordshire)
 * Theme: Event-Driven Programming & UI State Coordination
 * 
 * ARCHITECTURE EXPLANATION:
 * Acts as the centralized mediator for client-side routing, notification toasts,
 * global player state, and event synchronization across feature modules.
 * ============================================================================
 */

// Global Application State
window.AppState = {
  currentUser: null,
  stats: {
    totalScore: 0,
    puzzlesSolved: 0,
    bossDamage: 0,
    attackCharges: 0
  },
  currentView: 'dashboard'
};

/**
 * Display a modern toast notification in the UI
 * @param {string} message 
 * @param {'info'|'success'|'error'|'warning'} type 
 * @param {number} duration 
 */
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconMap = {
    info: 'ℹ️',
    success: '🎉',
    error: '⚠️',
    warning: '⚡'
  };

  toast.innerHTML = `
    <span style="font-size: 1.25rem;">${iconMap[type] || 'ℹ️'}</span>
    <div style="flex: 1;">${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Switch the visible Single-Page Application (SPA) view panel
 * @param {'dashboard'|'puzzle'|'boss'|'leaderboard'|'evidence'} viewName 
 */
function switchView(viewName) {
  const views = ['dashboard', 'puzzle', 'boss', 'leaderboard', 'evidence'];
  if (!views.includes(viewName)) return;

  window.AppState.currentView = viewName;

  // Toggle view panels
  views.forEach(v => {
    const panel = document.getElementById(`view-${v}`);
    const navBtn = document.getElementById(`nav-btn-${v}`);
    if (panel) panel.classList.toggle('active', v === viewName);
    if (navBtn) navBtn.classList.toggle('active', v === viewName);
  });

  // Event-Driven Actions on View Entry
  if (viewName === 'boss') {
    // Start active polling when entering the boss arena
    if (window.BossModule && window.BossModule.startPolling) {
      window.BossModule.startPolling();
    }
  } else {
    // Pause polling when viewing other tabs to save bandwidth and CPU
    if (window.BossModule && window.BossModule.stopPolling) {
      window.BossModule.stopPolling();
    }
  }

  if (viewName === 'puzzle') {
    // Auto-fetch puzzle if none loaded
    if (window.PuzzleModule && window.PuzzleModule.initPuzzle) {
      window.PuzzleModule.initPuzzle();
    }
  }

  if (viewName === 'leaderboard') {
    // Refresh leaderboard standings
    if (window.LeaderboardModule && window.LeaderboardModule.loadLeaderboard) {
      window.LeaderboardModule.loadLeaderboard();
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Update UI counters and dashboard stats to reflect the current state
 */
function updateStatsUI() {
  const stats = window.AppState.stats;

  // Dashboard counters
  const totalScoreEl = document.getElementById('dash-total-score');
  const puzzlesSolvedEl = document.getElementById('dash-puzzles-solved');
  const bossDamageEl = document.getElementById('dash-boss-damage');
  const attackChargesEl = document.getElementById('dash-attack-charges');
  
  // Navigation & Boss badges
  const navChargesEl = document.getElementById('nav-charge-count');
  const bossChargeDisplayEl = document.getElementById('boss-charge-display');

  if (totalScoreEl) totalScoreEl.textContent = stats.totalScore;
  if (puzzlesSolvedEl) puzzlesSolvedEl.textContent = stats.puzzlesSolved;
  if (bossDamageEl) bossDamageEl.textContent = stats.bossDamage;
  if (attackChargesEl) attackChargesEl.textContent = stats.attackCharges;
  if (navChargesEl) navChargesEl.textContent = stats.attackCharges;
  if (bossChargeDisplayEl) bossChargeDisplayEl.textContent = stats.attackCharges;
}

// ----------------------------------------------------------------------------
// DOM Event Listeners & Application Bootstrap
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Navigation Brand Click -> Dashboard
  document.getElementById('nav-brand')?.addEventListener('click', () => switchView('dashboard'));

  // Nav Links Click Handlers
  document.getElementById('nav-btn-dashboard')?.addEventListener('click', () => switchView('dashboard'));
  document.getElementById('nav-btn-puzzle')?.addEventListener('click', () => switchView('puzzle'));
  document.getElementById('nav-btn-boss')?.addEventListener('click', () => switchView('boss'));
  document.getElementById('nav-btn-leaderboard')?.addEventListener('click', () => switchView('leaderboard'));
  document.getElementById('nav-btn-evidence')?.addEventListener('click', () => switchView('evidence'));

  // Dashboard Action Shortcuts
  document.getElementById('dash-btn-start-puzzle')?.addEventListener('click', () => {
    if (!window.AppState.currentUser) {
      showToast('Please log in or register first to solve puzzles!', 'warning');
      window.AuthModule?.openModal('login');
      return;
    }
    switchView('puzzle');
  });

  document.getElementById('dash-btn-join-boss')?.addEventListener('click', () => {
    switchView('boss');
  });

  // Check user session on page load
  if (window.AuthModule && window.AuthModule.checkAuthStatus) {
    window.AuthModule.checkAuthStatus();
  }
});
