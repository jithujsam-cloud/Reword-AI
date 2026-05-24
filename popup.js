import { SUPABASE_URL, SUPABASE_ANON_KEY, OPENAI_API_KEY } from './config.js';

// Configuration and state variables
const DODO_PAYMENT_LINK = "https://dodo.pe/zqg57npt9js";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let supabaseUserId = null;
let userEmail = null;
let rewritesLimit = 3;
let usageCount = 0;
let licenseKey = "";
let isPro = false;

/**
 * Displays an inline error banner on the current visible screen.
 * @param {string} message - The error message to display.
 */
function showError(message) {
  clearError();

  const banner = document.createElement("div");
  banner.id = "error-banner";
  banner.style.cssText = [
    "background: #3b0d0d",
    "color: #ff9999",
    "border: 1px solid #7a2020",
    "border-radius: 8px",
    "padding: 10px 14px",
    "margin: 10px 16px 0",
    "font-size: 12.5px",
    "line-height: 1.5",
    "display: flex",
    "align-items: flex-start",
    "gap: 8px",
    "animation: fadeIn 0.2s ease"
  ].join(";");

  banner.innerHTML = `
    <span style="font-size:16px;flex-shrink:0;">⚠️</span>
    <span id="error-banner-msg"></span>
    <button id="btn-close-error" style="
      margin-left:auto;background:none;border:none;color:#ff9999;
      cursor:pointer;font-size:16px;line-height:1;flex-shrink:0;padding:0;
    ">✕</button>
  `;

  const msgSpan = banner.querySelector("#error-banner-msg");
  msgSpan.innerHTML = message;
  
  banner.querySelector("#btn-close-error").addEventListener("click", clearError);
  
  const dodoLink = banner.querySelector("#dodo-portal-link");
  if (dodoLink) {
    dodoLink.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({url: 'https://dodo.pe/zqg57npt9js'});
    });
  }

  const visibleScreen = document.querySelector(".screen:not(.hidden)");
  if (visibleScreen) {
    visibleScreen.insertBefore(banner, visibleScreen.firstChild);
  }
}

function clearError() {
  const existing = document.getElementById("error-banner");
  if (existing) existing.remove();
}

// DOM Elements
const screenMain = document.getElementById("screen-main");
const screenResult = document.getElementById("screen-result");
const screenSettings = document.getElementById("screen-settings");
const screenUpgrade = document.getElementById("screen-upgrade");
const screenAuth = document.getElementById("screen-auth");
const loadingOverlay = document.getElementById("loading-overlay");

const editorInput = document.getElementById("editor-input");
const usageFreeText = document.getElementById("usage-free-text");
const licenseKeyInput = document.getElementById("license-key-input");

const footerUsage1 = document.getElementById("footer-usage-1");
const footerUsage3 = document.getElementById("footer-usage-3");
const footerUsage4 = document.getElementById("footer-usage-4");
const footerUsage5 = document.getElementById("footer-usage-5");

/**
 * Navigation utility
 */
function showScreen(screenId) {
  screenMain.classList.add("hidden");
  screenResult.classList.add("hidden");
  screenSettings.classList.add("hidden");
  screenUpgrade.classList.add("hidden");
  screenAuth.classList.add("hidden");
  
  document.getElementById(screenId).classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  // CRITICAL RULE 1: NOTHING renders before auth check completes.
  // Hide all screens explicitly first
  screenMain.classList.add("hidden");
  
  chrome.storage.local.get(["supabase_session", "supabase_user_id", "user_email", "plan", "rewrites_used", "rewrites_limit", "payment_status", "licenseKey"], async (result) => {
    supabaseUserId = result.supabase_user_id;
    userEmail = result.user_email;
    
    if (result.supabase_session) {
      await supabase.auth.setSession({
        access_token: result.supabase_session.access_token,
        refresh_token: result.supabase_session.refresh_token
      });
    }

    // Verify session is still valid
    const { data: { session } } = await supabase.auth.getSession();
    
    if (supabaseUserId && session) {
      showScreen("screen-main");
      loadUserDataAndSupabase(result);
    } else {
      showScreen("screen-auth");
    }
  });

  // 2. Auth Page Navigation Listener
  document.getElementById("btn-auth-signin").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://clospect.online/signin.html" });
  });

  document.getElementById("btn-auth-signup").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: "https://clospect.online/signup.html" });
  });

  // 3. Listen for AUTH_SUCCESS or SESSION_FROM_WEBSITE messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'AUTH_SUCCESS') {
      chrome.storage.local.get(["supabase_user_id", "user_email", "plan", "rewrites_used", "rewrites_limit", "payment_status", "licenseKey"], (result) => {
        supabaseUserId = result.supabase_user_id;
        userEmail = result.user_email;
        showScreen("screen-main");
        loadUserDataAndSupabase(result);
      });
    } else if (message.type === 'SESSION_FROM_WEBSITE') {
      const session = message.session;
      if (session && session.user) {
        chrome.storage.local.set({
          supabase_user_id: session.user.id,
          user_email: session.user.email,
          supabase_session: session
        }, async () => {
          supabaseUserId = session.user.id;
          userEmail = session.user.email;
          
          await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token
          });

          showScreen("screen-main");
          // fetch user profile data and update UI
          chrome.storage.local.get(["plan", "rewrites_used", "rewrites_limit", "payment_status", "licenseKey"], (result) => {
            loadUserDataAndSupabase(result);
          });
        });
      }
    }
  });

  // 3. Attempt to grab selected text from the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "getSelectedText" }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response && response.text && response.text.trim()) {
          editorInput.value = response.text.trim();
        }
      });
    }
  });

  // 4. Setup Navigation Event Listeners
  document.getElementById("btn-goto-settings").addEventListener("click", () => showScreen("screen-settings"));
  document.getElementById("btn-goto-settings-from-result").addEventListener("click", () => showScreen("screen-settings"));
  document.getElementById("btn-goto-settings-from-upgrade").addEventListener("click", () => showScreen("screen-settings"));
  document.getElementById("btn-back-settings").addEventListener("click", () => {
    if (!isPro && usageCount >= rewritesLimit) {
      showScreen("screen-upgrade");
    } else {
      showScreen("screen-main");
    }
  });

  // Action Button Listeners
  document.getElementById("btn-deai").addEventListener("click", handleDeAI);
  document.getElementById("btn-replace").addEventListener("click", handleReplace);

  document.getElementById("btn-copy").addEventListener("click", () => {
    const text = document.getElementById("result-rewritten-text").textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById("btn-copy");
      btn.classList.add("copied");
      btn.innerHTML = '<span class="material-symbols-outlined">check</span> Copied!';
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.innerHTML = '<span class="material-symbols-outlined">content_copy</span> Copy';
      }, 1500);
    }).catch(() => {
      showError("Could not copy to clipboard. Please copy the text manually.");
    });
  });
  
  document.getElementById("btn-discard").addEventListener("click", () => {
    showScreen("screen-main");
  });

  document.getElementById("btn-activate").addEventListener("click", handleActivatePro);

  document.getElementById("row-manage-account").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://reword.co/account" });
  });

  document.getElementById("btn-get-pro").addEventListener("click", () => {
    chrome.tabs.create({ url: DODO_PAYMENT_LINK });
  });

  document.getElementById("btn-maybe-later").addEventListener("click", () => {
    showScreen("screen-main");
  });

  // Thumbs up/down interactions
  const thumbUp = document.getElementById("feedback-thumb-up");
  const thumbDown = document.getElementById("feedback-thumb-down");
  
  thumbUp.addEventListener("click", () => {
    thumbUp.classList.add("active");
    thumbDown.classList.remove("active");
  });

  thumbDown.addEventListener("click", () => {
    thumbDown.classList.add("active");
    thumbUp.classList.remove("active");
  });

  editorInput.addEventListener("focus", () => {
    editorInput.style.transform = "scale(1.005)";
  });
  editorInput.addEventListener("blur", () => {
    editorInput.style.transform = "scale(1.0)";
  });
});


function loadUserDataAndSupabase(result) {
  usageCount = result.rewrites_used || 0;
  rewritesLimit = result.rewrites_limit || 3;
  isPro = (result.plan === 'pro') || (result.licenseKey && result.licenseKey.trim().length >= 16);
  
  if (result.licenseKey) {
    licenseKeyInput.value = result.licenseKey;
  }
  
  updateUsageDisplay();
  injectSettingsContent(userEmail, isPro);
  fetchSupabaseData();
  
  // Step 5: Free User Hits Limit logic
  if (!isPro && usageCount >= rewritesLimit) {
    showScreen("screen-upgrade");
  }
}

async function fetchSupabaseData() {
  if (!supabaseUserId) return;
  try {
    const { data: userRow, error } = await supabase
      .from('users')
      .select('*')
      .eq('supabase_user_id', supabaseUserId)
      .single();
      
    if (userRow && !error) {
      chrome.storage.local.set({
        plan: userRow.plan,
        rewrites_used: userRow.rewrites_used,
        rewrites_limit: userRow.rewrites_limit,
        payment_status: userRow.payment_status
      });
      
      usageCount = userRow.rewrites_used;
      rewritesLimit = userRow.rewrites_limit;
      isPro = (userRow.plan === 'pro') || (licenseKeyInput.value && licenseKeyInput.value.trim().length >= 16);
      
      updateUsageDisplay();
      injectSettingsContent(userEmail, isPro);
      
      if (!isPro && usageCount >= rewritesLimit) {
        showScreen("screen-upgrade");
      }
      
      if (userRow.payment_status === 'failed') {
        showError("Payment failed. Update your card → <a href='#' id='dodo-portal-link'>Dodo Portal</a>");
      }
    }
  } catch (e) {
    console.error("Supabase sync error", e);
  }
}

/**
 * Update all elements reflecting usage and subscription state
 */
function updateUsageDisplay() {
  const mainUsageDiv = document.querySelector('.usage-text');
  if (isPro) {
    // CRITICAL RULE 5: Pro users never see a usage counter.
    if (mainUsageDiv) mainUsageDiv.style.display = 'none';
    footerUsage1.textContent = "Plan: PRO";
    footerUsage3.textContent = "Plan: PRO";
    footerUsage4.textContent = "Plan: PRO";
    footerUsage5.textContent = "Plan: PRO";
  } else {
    if (mainUsageDiv) mainUsageDiv.style.display = 'flex';
    const remaining = Math.max(0, rewritesLimit - usageCount);
    usageFreeText.textContent = `${remaining} of ${rewritesLimit} free uses left`;
    
    const usageStr = `Usage: ${usageCount}/${rewritesLimit}`;
    footerUsage1.textContent = usageStr;
    footerUsage3.textContent = usageStr;
    footerUsage4.textContent = usageStr;
    footerUsage5.textContent = usageStr;
  }
}

/**
 * Action: Screen 1 -> Process text with API
 */
function handleDeAI() {
  const originalText = editorInput.value.trim();
  
  if (!originalText) {
    editorInput.style.borderColor = "var(--text-dark)";
    setTimeout(() => {
      editorInput.style.borderColor = "var(--border-color)";
    }, 1000);
    return;
  }

  if (!isPro && usageCount >= rewritesLimit) {
    showScreen("screen-upgrade");
    return;
  }

  // Show Loading overlay
  loadingOverlay.classList.remove("hidden");

  // Send request to background.js
  chrome.runtime.sendMessage(
    { action: "rewriteText", text: originalText },
    (response) => {
      loadingOverlay.classList.add("hidden");

      if (chrome.runtime.lastError) {
        showError("Could not connect to the background service. Try reloading the extension.");
        return;
      }

      if (response && response.success) {
        if (!isPro) {
          usageCount++;
          chrome.storage.local.set({ rewrites_used: usageCount }, () => {
            updateUsageDisplay();
          });
          if (supabaseUserId) {
            supabase.from('users')
              .update({ rewrites_used: usageCount })
              .eq('supabase_user_id', supabaseUserId)
              .then(({ error }) => {
                if (error) console.error("Update rewrites error", error);
              });
          }
        }

        document.getElementById("feedback-thumb-up").classList.remove("active");
        document.getElementById("feedback-thumb-down").classList.remove("active");

        document.getElementById("result-original-text").textContent = originalText;
        document.getElementById("result-rewritten-text").textContent = response.rewrittenText;

        clearError();
        showScreen("screen-result");
      } else {
        showError(response ? response.error : "An unknown error occurred during rewriting.");
      }
    }
  );
}

function handleReplace() {
  const rewrittenText = document.getElementById("result-rewritten-text").textContent;
  const replaceBtn = document.getElementById("btn-replace");
  const originalContent = replaceBtn.innerHTML;

  replaceBtn.innerHTML = '<span class="material-symbols-outlined" style="animation: spin 0.8s linear infinite;">sync</span> Replacing...';
  replaceBtn.disabled = true;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "replaceText", text: rewrittenText },
        (response) => {
          if (chrome.runtime.lastError || !response || !response.success) {
            replaceBtn.innerHTML = originalContent;
            replaceBtn.disabled = false;
            showError("Could not insert text on this page automatically. Please copy the rewritten text and paste it manually.");
            return;
          }

          replaceBtn.innerHTML = '<span class="material-symbols-outlined">done_all</span> Applied';
          replaceBtn.style.backgroundColor = "#0e6c4a";

          setTimeout(() => {
            window.close();
          }, 600);
        }
      );
    } else {
      replaceBtn.innerHTML = originalContent;
      replaceBtn.disabled = false;
    }
  });
}

function handleActivatePro() {
  const enteredKey = licenseKeyInput.value.trim();

  if (enteredKey.length >= 16) {
    chrome.storage.local.set({ licenseKey: enteredKey }, () => {
      licenseKey = enteredKey;
      isPro = true;
      updateUsageDisplay();
      clearError();
      showScreen("screen-main");
    });
  } else {
    showError("Invalid license key. It must be at least 16 characters long.");
  }
}

function injectSettingsContent(email, isPremium) {
  let settingsMain = document.querySelector('#screen-settings main');
  
  // Clear any dynamically added sections
  const oldProfile = document.getElementById("user-profile-section");
  const oldFreeTier = document.getElementById("free-tier-section");
  if (oldProfile) oldProfile.remove();
  if (oldFreeTier) oldFreeTier.remove();
  
  // The License Key box
  const licenseCard = document.querySelectorAll('.settings-card')[0]; 
  if (supabaseUserId) {
    if (licenseCard) licenseCard.style.display = 'none';
  } else {
    if (licenseCard) licenseCard.style.display = 'flex';
  }
  
  // User Profile Section (only if logged in)
  if (supabaseUserId) {
    const profileSection = document.createElement('div');
    profileSection.id = "user-profile-section";
    profileSection.className = "free-tier-card"; 
    
    // Extract initials from email or name
    let initials = email ? email.substring(0, 2).toUpperCase() : "U";
    let name = email ? email.split('@')[0] : "User";
    
    profileSection.innerHTML = `
      <div class="user-profile-header">
        <div class="user-avatar">${initials}</div>
        <div class="user-info-text">
          <span class="user-info-name">${name}</span>
          <span class="user-info-email">${email || ''}</span>
        </div>
      </div>
      <button id="btn-signout" class="btn-secondary" style="width: 100%;">Sign Out</button>
    `;
    
    settingsMain.appendChild(profileSection);
    
    profileSection.querySelector('#btn-signout').addEventListener('click', async () => {
      await supabase.auth.signOut();
      chrome.storage.local.clear(() => {
        supabaseUserId = null;
        userEmail = null;
        isPro = false;
        usageCount = 0;
        showScreen("screen-auth");
        injectSettingsContent(null, false);
      });
    });
  }
  
  // Free Tier Section
  if (!isPremium) {
    const freeTierSection = document.createElement('div');
    freeTierSection.id = "free-tier-section";
    freeTierSection.className = "free-tier-card";
    
    const fillPercent = Math.min(100, (usageCount / rewritesLimit) * 100);
    
    freeTierSection.innerHTML = `
      <div class="free-tier-header">Free Tier</div>
      <div class="free-tier-stats">
        <span class="label">Rewrites used:</span>
        <span class="value">${usageCount} of ${rewritesLimit}</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: ${fillPercent}%"></div>
      </div>
      ${!supabaseUserId 
        ? `<button id="btn-auth-signup-settings" class="btn-primary" style="margin-top: 4px;">Sign In / Sign Up &rarr;</button>`
        : `<button id="btn-upgrade-pro" class="btn-primary" style="margin-top: 4px;">Upgrade to Pro &rarr;</button>`
      }
    `;
    
    settingsMain.appendChild(freeTierSection);
    
    if (!supabaseUserId) {
      freeTierSection.querySelector('#btn-auth-signup-settings').addEventListener("click", () => {
        chrome.tabs.create({ url: "https://clospect.online/signin.html" });
      });
    } else {
      freeTierSection.querySelector('#btn-upgrade-pro').addEventListener("click", () => {
        window.open(DODO_PAYMENT_LINK, '_blank');
      });
    }
  } else if (isPremium && supabaseUserId) {
    const premiumSection = document.createElement('div');
    premiumSection.id = "free-tier-section"; 
    premiumSection.className = "free-tier-card";
    premiumSection.innerHTML = `
      <div class="free-tier-header" style="color: #0e6c4a;">Premium Active ✨</div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">You have unlimited access.</div>
      <button id="btn-manage-sub" class="btn-secondary" style="margin-top: 4px;">Manage subscription &rarr;</button>
    `;
    settingsMain.appendChild(premiumSection);
    premiumSection.querySelector('#btn-manage-sub').addEventListener("click", () => {
      window.open(DODO_PAYMENT_LINK, '_blank');
    });
  }
}
