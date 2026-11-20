/**
 * ============================================================================
 * Banana Boss Raid - Puzzle Interoperability Module (puzzle.js)
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise
 * Theme: C. Interoperability & B. Event-Driven Client Interactions
 * 
 * ARCHITECTURE EXPLANATION:
 * Communicates with backend endpoints to fetch external Banana API puzzles,
 * handles keypad clicks and keyboard inputs, submits answers for server-side
 * evaluation, and provides clear visual feedback and score updates.
 * ============================================================================
 */

window.PuzzleModule = (function () {
  let activePuzzleId = null;
  let isSubmitting = false;

  const imageBoxEl = document.getElementById('puzzle-image-box');
  const spinnerEl = document.getElementById('puzzle-spinner');
  const imageEl = document.getElementById('puzzle-image');
  const feedbackEl = document.getElementById('puzzle-feedback');
  const answerInputEl = document.getElementById('puzzle-answer-input');
  const submitBtn = document.getElementById('btn-submit-puzzle');
  const nextBtn = document.getElementById('btn-next-puzzle');
  const toBossBtn = document.getElementById('btn-puzzle-to-boss');
  const sourceTagEl = document.getElementById('puzzle-source-indicator');
  const keypadButtons = document.querySelectorAll('.keypad-btn');

  /**
   * Initialize or retrieve puzzle upon entering the Puzzle tab
   */
  function initPuzzle() {
    if (!window.AppState.currentUser) {
      showToast('Please sign in or register to solve puzzles and earn points.', 'warning');
      window.AuthModule?.openModal('login');
      return;
    }

    if (!activePuzzleId) {
      fetchNewPuzzle();
    }
  }

  /**
   * Request a new puzzle from the backend service
   */
  async function fetchNewPuzzle() {
    if (!window.AppState.currentUser) return;

    // Reset UI state
    activePuzzleId = null;
    if (spinnerEl) spinnerEl.style.display = 'block';
    if (imageEl) imageEl.style.display = 'none';
    if (feedbackEl) feedbackEl.className = 'puzzle-feedback-banner';
    if (answerInputEl) {
      answerInputEl.value = '';
      answerInputEl.disabled = false;
    }
    if (toBossBtn) toBossBtn.style.display = 'none';
    if (submitBtn) submitBtn.disabled = true;

    // Reset keypad selection
    keypadButtons.forEach(btn => btn.classList.remove('selected'));

    try {
      const res = await fetch('/api/puzzle/new');
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch new puzzle.');
      }

      activePuzzleId = data.puzzleId;

      // Update API source tag
      if (sourceTagEl) {
        if (data.source === 'official_banana_api') {
          sourceTagEl.innerHTML = '<span>📡</span> Official Banana API (Live)';
          sourceTagEl.style.borderColor = 'var(--cyan-neon)';
          sourceTagEl.style.color = 'var(--cyan-neon)';
        } else {
          sourceTagEl.innerHTML = '<span>⚙️</span> Offline Fallback Engine';
          sourceTagEl.style.borderColor = 'var(--banana-yellow)';
          sourceTagEl.style.color = 'var(--banana-yellow)';
        }
      }

      // Preload image
      if (imageEl) {
        imageEl.onload = () => {
          if (spinnerEl) spinnerEl.style.display = 'none';
          imageEl.style.display = 'block';
          if (submitBtn) submitBtn.disabled = false;
          answerInputEl?.focus();
        };
        imageEl.onerror = () => {
          if (spinnerEl) spinnerEl.style.display = 'none';
          showToast('Image load error. Retrying...', 'error');
        };
        imageEl.src = data.question;
      }
    } catch (err) {
      if (spinnerEl) spinnerEl.style.display = 'none';
      showToast(err.message || 'Error loading puzzle.', 'error');
    }
  }

  /**
   * Submit the player's answer to the server for validation
   */
  async function submitAnswer() {
    if (isSubmitting || !activePuzzleId) return;

    const answer = answerInputEl?.value.trim();
    if (answer === '' || isNaN(answer)) {
      showToast('Please choose or enter a valid number (0-9).', 'warning');
      answerInputEl?.focus();
      return;
    }

    isSubmitting = true;
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await fetch('/api/puzzle/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          puzzleId: activePuzzleId,
          answer: parseInt(answer, 10)
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.message || data.error || 'Submission failed.', 'error');
        if (feedbackEl) {
          feedbackEl.className = 'puzzle-feedback-banner incorrect';
          feedbackEl.textContent = data.message || 'Error submitting answer.';
        }
        return;
      }

      // Handle Evaluation Result
      if (data.correct) {
        // Correct Answer!
        if (feedbackEl) {
          feedbackEl.className = 'puzzle-feedback-banner correct';
          feedbackEl.innerHTML = `<strong>🎉 Correct Answer!</strong> +${data.pointsAwarded} Points! Weapon charged with ⚡ 1 Boss Attack!`;
        }
        showToast('Superb! You solved the puzzle and unlocked an attack!', 'success');

        // Reveal quick action to jump into the boss arena
        if (toBossBtn) toBossBtn.style.display = 'inline-flex';
      } else {
        // Incorrect Answer
        if (feedbackEl) {
          feedbackEl.className = 'puzzle-feedback-banner incorrect';
          feedbackEl.innerHTML = `<strong>❌ Incorrect Answer.</strong> Try another puzzle to earn your attack charge!`;
        }
        showToast('Incorrect answer. Try the next puzzle!', 'error');
      }

      // Update state and UI stats
      if (data.stats) {
        window.AppState.stats = data.stats;
        updateStatsUI();
      }

      // Lock input for this finished puzzle session
      if (answerInputEl) answerInputEl.disabled = true;
      activePuzzleId = null; // Prevent repeated submission
    } catch (err) {
      showToast('Error validating answer on server.', 'error');
    } finally {
      isSubmitting = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  // --------------------------------------------------------------------------
  // Event Listeners Initialization
  // --------------------------------------------------------------------------

  // Numeric Keypad Click Handling
  keypadButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-val');
      if (answerInputEl && !answerInputEl.disabled) {
        answerInputEl.value = val;
        keypadButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      }
    });
  });

  // Keyboard Enter Submission
  answerInputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitAnswer();
    }
  });

  // Direct numeric input highlights matching keypad button
  answerInputEl?.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    keypadButtons.forEach(btn => {
      btn.classList.toggle('selected', btn.getAttribute('data-val') === val);
    });
  });

  // Buttons
  submitBtn?.addEventListener('click', submitAnswer);
  nextBtn?.addEventListener('click', fetchNewPuzzle);
  toBossBtn?.addEventListener('click', () => switchView('boss'));

  return {
    initPuzzle,
    fetchNewPuzzle,
    submitAnswer
  };
})();
