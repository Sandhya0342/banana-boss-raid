/**
 * ============================================================================
 * Banana Boss Raid - Cooperative Boss Raid Module (boss.js)
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise
 * Theme: B. Event-Driven Cooperative Boss Battle & REST Polling
 * 
 * ARCHITECTURE EXPLANATION:
 * Implements REST polling (3s interval) to synchronize shared multi-player
 * raid health and combat feeds without heavy WebSocket overhead.
 * Handles client-side attack events, critical hits, damage shake animations,
 * and floating combat text popups.
 * ============================================================================
 */

window.BossModule = (function () {
  let pollingTimer = null;
  let isAttacking = false;
  let currentBossId = null;

  const stageCardEl = document.getElementById('boss-stage-card');
  const avatarWrapperEl = document.getElementById('boss-avatar-wrapper');
  const bossNameEl = document.getElementById('boss-name');
  const statusBadgeEl = document.getElementById('boss-status-badge');
  const healthFillEl = document.getElementById('boss-health-fill');
  const healthTextEl = document.getElementById('boss-health-text');
  const victoryBoxEl = document.getElementById('boss-victory-box');
  const attackConsoleEl = document.getElementById('boss-attack-console');
  const attackBtn = document.getElementById('btn-attack-boss');
  const getChargesBtn = document.getElementById('btn-get-more-charges');
  const restartRaidBtn = document.getElementById('btn-restart-raid');
  const participantsTbody = document.getElementById('raid-participants-tbody');
  const activityFeedList = document.getElementById('raid-feed-list');
  const damagePopupContainer = document.getElementById('damage-popup-container');

  /**
   * Start periodic REST polling to sync boss state with server
   */
  function startPolling() {
    stopPolling();
    fetchBossStatus();
    pollingTimer = setInterval(fetchBossStatus, 3000);
  }

  /**
   * Stop polling (called when leaving the boss arena)
   */
  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  }

  /**
   * Fetch current shared boss state and update the UI
   */
  async function fetchBossStatus() {
    try {
      const res = await fetch('/api/boss/status');
      const data = await res.json();

      if (!res.ok || !data.success) return;

      currentBossId = data.boss.id;
      renderBossUI(data.boss);
      renderParticipants(data.participants);
      renderActivityFeed(data.activityFeed);

      if (data.userCharges !== undefined) {
        window.AppState.stats.attackCharges = data.userCharges;
        updateStatsUI();
      }
    } catch (err) {
      console.warn('[BossModule] Poll status error:', err.message);
    }
  }

  /**
   * Render the Boss Health Bar, State, and Visual Status
   */
  function renderBossUI(boss) {
    if (bossNameEl) bossNameEl.textContent = boss.name;

    const percentage = Math.max(0, Math.min(100, boss.percentage));

    if (healthFillEl) {
      healthFillEl.style.width = `${percentage}%`;
      healthFillEl.className = 'health-bar-fill';
      if (percentage <= 25) {
        healthFillEl.classList.add('low-hp');
      } else if (percentage <= 50) {
        healthFillEl.classList.add('medium-hp');
      }
    }

    if (healthTextEl) {
      healthTextEl.textContent = `${boss.currentHealth} / ${boss.maxHealth} HP (${percentage}%)`;
    }

    const isDefeated = boss.status === 'defeated' || boss.currentHealth === 0;

    if (statusBadgeEl) {
      statusBadgeEl.textContent = isDefeated ? 'DEFEATED' : 'ACTIVE RAID';
      statusBadgeEl.className = `boss-status-badge ${isDefeated ? 'defeated' : 'active'}`;
    }

    if (avatarWrapperEl) {
      avatarWrapperEl.classList.toggle('boss-defeated', isDefeated);
    }

    if (victoryBoxEl) {
      victoryBoxEl.style.display = isDefeated ? 'block' : 'none';
    }

    if (attackConsoleEl) {
      attackConsoleEl.style.display = isDefeated ? 'none' : 'flex';
    }
  }

  /**
   * Render Raid Participants Contributor Table
   */
  function renderParticipants(participants) {
    if (!participantsTbody) return;

    if (!participants || participants.length === 0) {
      participantsTbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; color: var(--text-muted); padding: 16px;">
            No attacks registered yet in this raid. Be the first to strike!
          </td>
        </tr>
      `;
      return;
    }

    participantsTbody.innerHTML = participants.map((p, idx) => {
      const isMe = window.AppState.currentUser && p.user_id === window.AppState.currentUser.id;
      const rankIcon = idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
      return `
        <tr style="${isMe ? 'background: rgba(255, 204, 0, 0.1); font-weight: bold;' : ''}">
          <td>${rankIcon} ${escapeHtml(p.username)} ${isMe ? '<small style="color: var(--banana-yellow);">(You)</small>' : ''}</td>
          <td style="color: var(--banana-yellow); font-weight: 700;">${p.damage_dealt} HP</td>
          <td>${p.attacks_count}</td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Render Live Combat Activity Feed
   */
  function renderActivityFeed(feed) {
    if (!activityFeedList) return;

    if (!feed || feed.length === 0) {
      activityFeedList.innerHTML = `<div class="feed-item" style="color: var(--text-muted);">Awaiting combat activity...</div>`;
      return;
    }

    activityFeedList.innerHTML = feed.slice(0, 10).map(item => {
      const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `
        <div class="feed-item">
          <span>⚔️</span>
          <div style="flex: 1;">${escapeHtml(item.message)}</div>
          <span class="feed-time">${time}</span>
        </div>
      `;
    }).join('');
  }

  /**
   * Spawn a floating damage number on boss strike
   */
  function showDamageNumber(damage, isCritical) {
    if (!damagePopupContainer) return;

    const popup = document.createElement('div');
    popup.className = `floating-damage ${isCritical ? 'critical' : ''}`;
    popup.textContent = isCritical ? `💥 CRITICAL! -${damage}` : `-${damage}`;

    damagePopupContainer.appendChild(popup);

    setTimeout(() => popup.remove(), 1200);
  }

  /**
   * Trigger screen and card shake animation
   */
  function triggerHitAnimation() {
    if (stageCardEl) {
      stageCardEl.classList.remove('shake');
      // trigger reflow
      void stageCardEl.offsetWidth;
      stageCardEl.classList.add('shake');
    }
  }

  /**
   * Execute an attack against the shared boss
   */
  async function attackBoss() {
    if (isAttacking) return;

    if (!window.AppState.currentUser) {
      showToast('Please sign in or register to attack the boss!', 'warning');
      window.AuthModule?.openModal('login');
      return;
    }

    if (window.AppState.stats.attackCharges <= 0) {
      showToast('No attack charges! Solve a Banana Puzzle first to charge your attack.', 'warning');
      return;
    }

    isAttacking = true;
    if (attackBtn) attackBtn.disabled = true;

    try {
      const res = await fetch('/api/boss/attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.error || 'Attack failed.', 'error');
        return;
      }

      // Visual animations
      triggerHitAnimation();
      showDamageNumber(data.damageDealt, data.isCritical);

      // Toast feedback
      showToast(data.message, data.isCritical ? 'warning' : 'success');

      // Update UI components
      renderBossUI(data.boss);
      renderParticipants(data.participants);

      if (data.stats) {
        window.AppState.stats.totalScore = data.stats.totalScore;
        window.AppState.stats.puzzlesSolved = data.stats.puzzlesSolved;
        window.AppState.stats.bossDamage = data.stats.bossDamage;
      }
      window.AppState.stats.attackCharges = data.userCharges;
      updateStatsUI();

      if (data.boss.isDefeated) {
        showToast('VICTORY! You dealt the final blow to defeat the Boss!', 'success', 6000);
      }
    } catch (err) {
      showToast('Network error while launching attack.', 'error');
    } finally {
      isAttacking = false;
      if (attackBtn) attackBtn.disabled = false;
    }
  }

  /**
   * Reset / Start a fresh boss raid
   */
  async function restartRaid() {
    if (!window.AppState.currentUser) {
      showToast('Please sign in to start a new raid.', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/boss/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to start new raid.', 'error');
        return;
      }

      showToast(data.message, 'success');
      fetchBossStatus();
    } catch (err) {
      showToast('Error resetting boss raid.', 'error');
    }
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

  // --------------------------------------------------------------------------
  // Event Listeners Initialization
  // --------------------------------------------------------------------------
  attackBtn?.addEventListener('click', attackBoss);
  getChargesBtn?.addEventListener('click', () => switchView('puzzle'));
  restartRaidBtn?.addEventListener('click', restartRaid);

  return {
    startPolling,
    stopPolling,
    fetchBossStatus,
    attackBoss
  };
})();
