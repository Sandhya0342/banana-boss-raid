/**
 * ============================================================================
 * Banana Boss Raid - Authentication & Virtual Identity Module (auth.js)
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise
 * Theme: D. Virtual Identity & Event-Driven Form Handling
 * 
 * ARCHITECTURE EXPLANATION:
 * Handles registration and login form submissions, client-side input validation,
 * session lifecycle management, and dynamic user UI rendering.
 * ============================================================================
 */

window.AuthModule = (function () {
  const modalEl = document.getElementById('auth-modal');
  const tabLoginEl = document.getElementById('tab-login');
  const tabRegisterEl = document.getElementById('tab-register');
  const formLoginEl = document.getElementById('form-login');
  const formRegisterEl = document.getElementById('form-register');
  const loginErrorEl = document.getElementById('login-error-msg');
  const registerErrorEl = document.getElementById('register-error-msg');

  const guestSectionEl = document.getElementById('nav-guest-section');
  const userSectionEl = document.getElementById('nav-user-section');
  const navUsernameEl = document.getElementById('nav-username');
  const navUserAvatarEl = document.getElementById('nav-user-avatar');

  /**
   * Open the Authentication Modal
   * @param {'login'|'register'} tab 
   */
  function openModal(tab = 'login') {
    if (!modalEl) return;
    modalEl.classList.add('active');
    switchTab(tab);
  }

  /**
   * Close the Authentication Modal
   */
  function closeModal() {
    if (!modalEl) return;
    modalEl.classList.remove('active');
    clearErrors();
  }

  /**
   * Switch between Login and Registration tabs
   * @param {'login'|'register'} tab 
   */
  function switchTab(tab) {
    clearErrors();
    if (tab === 'login') {
      tabLoginEl?.classList.add('active');
      tabRegisterEl?.classList.remove('active');
      if (formLoginEl) formLoginEl.style.display = 'block';
      if (formRegisterEl) formRegisterEl.style.display = 'none';
      document.getElementById('login-username')?.focus();
    } else {
      tabRegisterEl?.classList.add('active');
      tabLoginEl?.classList.remove('active');
      if (formLoginEl) formLoginEl.style.display = 'none';
      if (formRegisterEl) formRegisterEl.style.display = 'block';
      document.getElementById('reg-username')?.focus();
    }
  }

  function clearErrors() {
    if (loginErrorEl) {
      loginErrorEl.textContent = '';
      loginErrorEl.style.display = 'none';
    }
    if (registerErrorEl) {
      registerErrorEl.textContent = '';
      registerErrorEl.style.display = 'none';
    }
  }

  function showFormError(element, message) {
    if (!element) return;
    element.textContent = message;
    element.style.display = 'block';
  }

  /**
   * Render User or Guest state in the Navbar
   */
  function renderAuthUI() {
    const user = window.AppState.currentUser;
    if (user) {
      if (guestSectionEl) guestSectionEl.style.display = 'none';
      if (userSectionEl) userSectionEl.style.display = 'flex';
      if (navUsernameEl) navUsernameEl.textContent = user.username;
      if (navUserAvatarEl) navUserAvatarEl.textContent = user.username.charAt(0).toUpperCase();
    } else {
      if (guestSectionEl) guestSectionEl.style.display = 'block';
      if (userSectionEl) userSectionEl.style.display = 'none';
    }
    updateStatsUI();
  }

  /**
   * Check active server session on app load
   */
  async function checkAuthStatus() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();

      if (data.success && data.loggedIn) {
        window.AppState.currentUser = data.user;
        window.AppState.stats = data.stats;
      } else {
        window.AppState.currentUser = null;
      }
      renderAuthUI();
    } catch (err) {
      console.warn('[AuthModule] Session check failed:', err.message);
      window.AppState.currentUser = null;
      renderAuthUI();
    }
  }

  /**
   * Handle Login Form Submission
   */
  async function handleLogin(e) {
    e.preventDefault();
    clearErrors();

    const usernameOrEmail = document.getElementById('login-username')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    const submitBtn = document.getElementById('btn-submit-login');

    if (!usernameOrEmail || !password) {
      showFormError(loginErrorEl, 'Please enter both username/email and password.');
      return;
    }

    try {
      if (submitBtn) submitBtn.disabled = true;
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail, password })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showFormError(loginErrorEl, data.error || 'Failed to sign in.');
        return;
      }

      closeModal();
      showToast(`Welcome back, ${data.user.username}!`, 'success');
      await checkAuthStatus();
    } catch (err) {
      showFormError(loginErrorEl, 'Network or server error during sign in.');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  /**
   * Handle Registration Form Submission
   */
  async function handleRegister(e) {
    e.preventDefault();
    clearErrors();

    const username = document.getElementById('reg-username')?.value.trim();
    const email = document.getElementById('reg-email')?.value.trim();
    const password = document.getElementById('reg-password')?.value;
    const confirmPassword = document.getElementById('reg-confirm-password')?.value;
    const submitBtn = document.getElementById('btn-submit-register');

    // Client-side validation checks
    if (!username || !email || !password || !confirmPassword) {
      showFormError(registerErrorEl, 'All fields are required.');
      return;
    }

    if (username.length < 3 || username.length > 20) {
      showFormError(registerErrorEl, 'Username must be between 3 and 20 characters.');
      return;
    }

    if (password.length < 6) {
      showFormError(registerErrorEl, 'Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      showFormError(registerErrorEl, 'Passwords do not match.');
      return;
    }

    try {
      if (submitBtn) submitBtn.disabled = true;
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, confirmPassword })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showFormError(registerErrorEl, data.error || 'Registration failed.');
        return;
      }

      closeModal();
      showToast(`Account created! Welcome to the raid, ${data.user.username}!`, 'success');
      await checkAuthStatus();
    } catch (err) {
      showFormError(registerErrorEl, 'Network or server error during registration.');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  /**
   * Handle Logout
   */
  async function handleLogout() {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        window.AppState.currentUser = null;
        window.AppState.stats = { totalScore: 0, puzzlesSolved: 0, bossDamage: 0, attackCharges: 0 };
        renderAuthUI();
        showToast('Logged out successfully.', 'info');
        switchView('dashboard');
      }
    } catch (err) {
      showToast('Error logging out.', 'error');
    }
  }

  // --------------------------------------------------------------------------
  // Event Listeners Initialization
  // --------------------------------------------------------------------------
  document.getElementById('btn-open-auth-modal')?.addEventListener('click', () => openModal('login'));
  document.getElementById('btn-close-auth-modal')?.addEventListener('click', closeModal);
  modalEl?.addEventListener('click', (e) => {
    if (e.target === modalEl) closeModal();
  });

  tabLoginEl?.addEventListener('click', () => switchTab('login'));
  tabRegisterEl?.addEventListener('click', () => switchTab('register'));

  formLoginEl?.addEventListener('submit', handleLogin);
  formRegisterEl?.addEventListener('submit', handleRegister);
  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);

  return {
    openModal,
    closeModal,
    checkAuthStatus,
    renderAuthUI
  };
})();
