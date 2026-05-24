// Configuration and state variables
const SUPABASE_URL = "https://zhoueuqnmtjskbiwnkzu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpob3VldXFubXRqc2tiaXdua3p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MjMzNDQsImV4cCI6MjA5NTA5OTM0NH0.7TZmr048orxLcAdqQrOaihvfAOEw4xGYpMaZviw-z-g";
const DODO_PAYMENT_LINK = "https://dodo.pe/zqg57npt9js";
let clerkUserId = null;
let clerkEmail = null;
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
  
  // 1. Check Auth Storage
  chrome.storage.local.get(["clerk_user_id", "clerk_email", "plan", "rewrites_used", "rewrites_limit", "payment_status", "licenseKey"], (result) => {
    clerkUserId = result.clerk_user_id;
    clerkEmail = result.clerk_email;
    
    // IF NOT LOGGED IN
    if (!clerkUserId) {
      showScreen("screen-auth");
      return; // CRITICAL RULE 2: Synchronous blocking. Do not load anything else.
    }
    
    // IF LOGGED IN
    showScreen("screen-main");
    loadUserDataAndSupabase(result);
  });

  // 2. Auth Page Navigation Listener
  document.getElementById("btn-auth-signin").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("auth.html") });
  });

  // CRITICAL RULE 3: Listen for AUTH_SUCCESS message
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'AUTH_SUCCESS') {
      clerkUserId = message.userId;
      clerkEmail = message.email;
      
      // Save it properly
      chrome.storage.local.set({ clerk_user_id: clerkUserId, clerk_email: clerkEmail });
      
      // Hide auth prompt, show main screen immediately
      showScreen("screen-main");
      
      // Fetch user data from Supabase
      fetchSupabaseData();
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
  injectSettingsContent(clerkEmail, isPro);
  fetchSupabaseData();
  
  // Step 5: Free User Hits Limit logic
  if (!isPro && usageCount >= rewritesLimit) {
    showScreen("screen-upgrade");
  }
}

async function fetchSupabaseData() {
  if (!clerkUserId) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?clerk_user_id=eq.${clerkUserId}&select=*`, {
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
    });
    const data = await res.json();
    if (data && data.length > 0) {
      const userRow = data[0];
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
      injectSettingsContent(clerkEmail, isPro);
      
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

  // CRITICAL RULE 4: Free users must never be able to run a rewrite after using all 3.
  if (!clerkUserId) {
    showScreen("screen-auth");
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
          
          if (clerkUserId) {
            fetch(`${SUPABASE_URL}/rest/v1/users?clerk_user_id=eq.${clerkUserId}`, {
              method: "PATCH",
              headers: { 
                "Content-Type": "application/json",
                "apikey": SUPABASE_ANON_KEY, 
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}` 
              },
              body: JSON.stringify({ rewrites_used: usageCount })
            }).catch(console.error);
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
  let userInfoDiv = document.getElementById("auth-user-info");
  if (!userInfoDiv) {
    userInfoDiv = document.createElement('div');
    userInfoDiv.id = "auth-user-info";
    userInfoDiv.className = "settings-card";
    userInfoDiv.style.marginTop = "16px";
    
    const settingsMain = document.querySelector('#screen-settings main');
    settingsMain.appendChild(userInfoDiv);
    
    const signoutDiv = document.createElement('div');
    signoutDiv.style.marginTop = "16px";
    signoutDiv.style.borderTop = "1px solid rgba(193, 200, 194, 0.3)";
    signoutDiv.style.paddingTop = "16px";
    
    const signoutBtn = document.createElement('button');
    signoutBtn.id = "btn-signout";
    signoutBtn.className = "btn-secondary";
    signoutBtn.style.width = "100%";
    signoutBtn.style.backgroundColor = "transparent";
    signoutBtn.style.border = "1px solid var(--border-color)";
    signoutBtn.style.padding = "10px";
    signoutBtn.style.borderRadius = "var(--border-radius-btn)";
    signoutBtn.style.cursor = "pointer";
    signoutBtn.textContent = "Sign out";
    
    // CRITICAL RULE 6: Signing out must clear ALL local storage and immediately show auth prompt
    signoutBtn.onclick = () => {
      chrome.storage.local.clear(() => {
        clerkUserId = null;
        clerkEmail = null;
        isPro = false;
        usageCount = 0;
        showScreen("screen-auth");
      });
    };
    
    signoutDiv.appendChild(signoutBtn);
    settingsMain.appendChild(signoutDiv);
  }
  
  userInfoDiv.innerHTML = `
    <div style="font-weight:600;margin-bottom:8px;font-size:13px;display:flex;align-items:center;justify-content:space-between;">
      ${email}
      <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${isPremium ? '#1b4332' : '#e0e0e0'};color:${isPremium ? 'white' : 'black'};">${isPremium ? 'PRO' : 'FREE'}</span>
    </div>
  `;
  
  if (isPremium) {
    userInfoDiv.innerHTML += `
      <div style="font-size:13px;color:#0e6c4a;margin-bottom:12px;font-weight:600;">Plan: Pro ✓</div>
      <button id="btn-manage-sub" class="btn-primary" style="background:transparent;border:1px solid var(--border-color);color:var(--text-dark);">Manage subscription &rarr;</button>
    `;
  } else {
    userInfoDiv.innerHTML += `
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">Rewrites used: ${usageCount} of ${rewritesLimit}</div>
      <button id="btn-upgrade-pro" class="btn-primary">Upgrade to Pro &rarr;</button>
    `;
  }

  const btnManage = document.getElementById("btn-manage-sub");
  if (btnManage) {
    btnManage.addEventListener("click", () => window.open(DODO_PAYMENT_LINK, '_blank'));
  }
  
  const btnUpgrade = document.getElementById("btn-upgrade-pro");
  if (btnUpgrade) {
    btnUpgrade.addEventListener("click", () => window.open(DODO_PAYMENT_LINK, '_blank'));
  }
}
