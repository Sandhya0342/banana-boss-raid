/**
 * ============================================================================
 * Banana Boss Raid - Leaderboard Module (leaderboard.js)
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise
 * Theme: D. Virtual Identity & Player Competition
 * 
 * ARCHITECTURE EXPLANATION:
 * Fetches and displays player rankings. Renders a podium for the top 3 players
 * and a table for the global standings.
 * ============================================================================
 */

window.LeaderboardModule = (function () {
  const podiumContainer = document.getElementById('leaderboard-podium');
  const tbodyEl = document.getElementById('leaderboard-tbody');
  const refreshBtn = document.getElementById('btn-refresh-leaderboard');

  /**
   * Fetch and render top players from the backend
   */
  async function loadLeaderboard() {
    try {
      if (tbodyEl) {
        tbodyEl.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">Fetching rankings...</td></tr>`;
      }

      const res = await fetch('/api/leaderboard?limit=25');
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load leaderboard.');
      }

      renderPodium(data.leaderboard.slice(0, 3));
      renderTable(data.leaderboard);
    } catch (err) {
      if (tbodyEl) {
        tbodyEl.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--neon-red); padding: 24px;">Failed to load leaderboard standings.</td></tr>`;
      }
    }
  }

  /**
   * Render Top 3 Podium
   */
  function renderPodium(top3) {
    if (!podiumContainer) return;

    if (!top3 || top3.length === 0) {
      podiumContainer.innerHTML = '';
      return;
    }

    const first = top3[0] || null;
    const second = top3[1] || null;
    const third = top3[2] || null;

    let html = '';

    if (second) {
      html += `
        <div class="podium-card podium-second">
          <div class="podium-rank-badge">🥈</div>
          <h4 style="color: #c0c0c0;">${escapeHtml(second.username)}</h4>
          <div style="font-size: 1.5rem; font-weight: 800; color: var(--banana-yellow); margin-top: 6px;">${second.total_score} pts</div>
          <small style="color: var(--text-secondary);">${second.boss_damage} Boss DMG</small>
        </div>
      `;
    }

    if (first) {
      html += `
        <div class="podium-card podium-first">
          <div class="podium-rank-badge">👑</div>
          <h3 style="color: #ffd700;">${escapeHtml(first.username)}</h3>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--banana-yellow); margin-top: 6px;">${first.total_score} pts</div>
          <small style="color: var(--text-secondary);">${first.boss_damage} Boss DMG • ${first.puzzles_solved} Puzzles</small>
        </div>
      `;
    }

    if (third) {
      html += `
        <div class="podium-card podium-third">
          <div class="podium-rank-badge">🥉</div>
          <h4 style="color: #cd7f32;">${escapeHtml(third.username)}</h4>
          <div style="font-size: 1.5rem; font-weight: 800; color: var(--banana-yellow); margin-top: 6px;">${third.total_score} pts</div>
          <small style="color: var(--text-secondary);">${third.boss_damage} Boss DMG</small>
        </div>
      `;
    }

    podiumContainer.innerHTML = html;
  }

  /**
   * Render Full Standings Table
   */
  function renderTable(rankings) {
    if (!tbodyEl) return;

    if (!rankings || rankings.length === 0) {
      tbodyEl.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">No player records found. Be the first to join!</td></tr>`;
      return;
    }

    tbodyEl.innerHTML = rankings.map((p, index) => {
      const isMe = window.AppState.currentUser && p.user_id === window.AppState.currentUser.id;
      const rank = index + 1;
      const rankBadge = rank === 1 ? '🥇 1' : rank === 2 ? '🥈 2' : rank === 3 ? '🥉 3' : `#${rank}`;
      const lastActive = p.last_active ? new Date(p.last_active).toLocaleDateString() : 'Recent';

      return `
        <tr style="${isMe ? 'background: rgba(255, 204, 0, 0.12); font-weight: bold;' : ''}">
          <td><strong>${rankBadge}</strong></td>
          <td>
            ${escapeHtml(p.username)}
            ${isMe ? '<span style="color: var(--banana-yellow); font-size: 0.8rem; margin-left: 6px;">(You)</span>' : ''}
          </td>
          <td style="color: var(--banana-yellow); font-weight: 800;">${p.total_score}</td>
          <td>${p.puzzles_solved}</td>
          <td>${p.boss_damage} HP</td>
          <td style="color: var(--text-muted); font-size: 0.85rem;">${lastActive}</td>
        </tr>
      `;
    }).join('');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  refreshBtn?.addEventListener('click', loadLeaderboard);

  return {
    loadLeaderboard
  };
})();
