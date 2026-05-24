const clerk = window.Clerk;

document.addEventListener("DOMContentLoaded", async () => {
  if (clerk) {
    await clerk.load();
    if (clerk.user) {
      onAuthSuccess();
    }
  }

  // Bind click events
  document.getElementById('link-forgot-password').addEventListener('click', () => switchView('view-forgot'));
  document.getElementById('link-go-signup').addEventListener('click', () => switchView('view-signup'));
  document.getElementById('link-go-signin').addEventListener('click', () => switchView('view-signin'));
  document.getElementById('link-back-to-signin').addEventListener('click', () => switchView('view-signin'));

  document.querySelectorAll('.btn-google-login').forEach(btn => {
    btn.addEventListener('click', signInWithGoogle);
  });
});

function switchView(viewId) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  hideError();
}

function showError(msg) {
  const box = document.getElementById('error-box');
  box.textContent = msg;
  box.style.display = 'block';
}

function hideError() {
  document.getElementById('error-box').style.display = 'none';
}

function setBtnLoading(btnId, isLoading, originalText) {
  const btn = document.getElementById(btnId);
  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined" style="animation: spin 1s linear infinite;">sync</span> Loading...';
  } else {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

async function onAuthSuccess() {
  try {
    if (!clerk.user) {
      await clerk.load();
    }
    const user = clerk.user;
    if (user) {
      const email = user.primaryEmailAddress ? user.primaryEmailAddress.emailAddress : (user.emailAddresses[0]?.emailAddress || "user@example.com");
      chrome.storage.local.set({ 
        clerk_user_id: user.id,
        clerk_email: email,
        clerk_session_id: clerk.session ? clerk.session.id : "no-session",
        authRefreshNeeded: Date.now() 
      }, () => {
        chrome.runtime.sendMessage({
          type: 'AUTH_SUCCESS',
          userId: user.id,
          email: email
        }, () => {
          chrome.runtime.lastError; // clear any error if popup is closed
          window.close();
        });
      });
    } else {
      showError("Could not load user profile.");
    }
  } catch (e) {
    showError(e.message);
  }
}

// === HANDLERS ===

// Sign In
document.getElementById('form-signin').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  setBtnLoading('btn-signin', true, 'Sign In');
  
  const emailAddress = document.getElementById('signin-email').value;
  const password = document.getElementById('signin-password').value;
  
  try {
    const res = await clerk.client.signIn.create({
      identifier: emailAddress,
      password,
    });
    
    if (res.status === "complete") {
      await clerk.setActive({ session: res.createdSessionId });
      onAuthSuccess();
    } else {
      showError("Please check your email for next steps.");
    }
  } catch (err) {
    showError(err.errors ? err.errors[0].longMessage : err.message);
  } finally {
    setBtnLoading('btn-signin', false, 'Sign In');
  }
});

// Sign Up
document.getElementById('form-signup').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  setBtnLoading('btn-signup', true, 'Create Account');
  
  const firstName = document.getElementById('signup-name').value;
  const emailAddress = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  
  try {
    await clerk.client.signUp.create({
      firstName,
      emailAddress,
      password,
    });
    
    await clerk.client.signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    switchView('view-verify');
  } catch (err) {
    showError(err.errors ? err.errors[0].longMessage : err.message);
  } finally {
    setBtnLoading('btn-signup', false, 'Create Account');
  }
});

// Verify Code (Sign Up)
document.getElementById('form-verify').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  setBtnLoading('btn-verify', true, 'Verify & Continue');
  
  const code = document.getElementById('verify-code').value;
  
  try {
    const res = await clerk.client.signUp.attemptEmailAddressVerification({ code });
    if (res.status === "complete") {
      await clerk.setActive({ session: res.createdSessionId });
      onAuthSuccess();
    } else {
      showError("Verification incomplete.");
    }
  } catch (err) {
    showError(err.errors ? err.errors[0].longMessage : err.message);
  } finally {
    setBtnLoading('btn-verify', false, 'Verify & Continue');
  }
});

// Forgot Password -> Send Code
document.getElementById('form-forgot').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  setBtnLoading('btn-forgot', true, 'Send Reset Link');
  
  const emailAddress = document.getElementById('forgot-email').value;
  
  try {
    await clerk.client.signIn.create({
      strategy: "reset_password_email_code",
      identifier: emailAddress
    });
    switchView('view-reset');
  } catch (err) {
    showError(err.errors ? err.errors[0].longMessage : err.message);
  } finally {
    setBtnLoading('btn-forgot', false, 'Send Reset Link');
  }
});

// Forgot Password -> Verify & Reset
document.getElementById('form-reset').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  setBtnLoading('btn-reset', true, 'Set New Password');
  
  const code = document.getElementById('reset-code').value;
  const password = document.getElementById('reset-password').value;
  
  try {
    const res = await clerk.client.signIn.attemptFirstFactor({
      strategy: "reset_password_email_code",
      code,
      password
    });
    
    if (res.status === "complete") {
      await clerk.setActive({ session: res.createdSessionId });
      onAuthSuccess();
    } else {
      showError("Reset incomplete. Try again.");
    }
  } catch (err) {
    showError(err.errors ? err.errors[0].longMessage : err.message);
  } finally {
    setBtnLoading('btn-reset', false, 'Set New Password');
  }
});

// Google OAuth
async function signInWithGoogle() {
  hideError();
  try {
    await clerk.client.signIn.authenticateWithRedirect({
      strategy: "oauth_google",
      redirectUrl: clerk.buildUrlWithAuth(window.location.href),
      redirectUrlComplete: window.location.href,
    });
  } catch (err) {
    showError(err.errors ? err.errors[0].longMessage : err.message);
  }
}

// Add CSS spin animation manually since it's not in the main css file
const style = document.createElement('style');
style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
document.head.appendChild(style);
