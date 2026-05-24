// session-bridge.js
const getSession = async () => {
  const keys = Object.keys(localStorage);
  // Supabase v2 stores the session under "sb-<project-ref>-auth-token".
  // The key does NOT contain the word "supabase", so we match the v2 pattern first.
  const sessionKey = keys.find(k =>
    (k.startsWith('sb-') && k.endsWith('-auth-token')) ||
    (k.includes('supabase') && k.includes('auth'))
  );
  
  if (sessionKey) {
    const sessionStr = localStorage.getItem(sessionKey);
    try {
      const session = JSON.parse(sessionStr);
      chrome.runtime.sendMessage({
        type: 'SESSION_FROM_WEBSITE',
        session: session
      });
    } catch (err) {
      console.error('Error parsing session from website', err);
    }
  }
};

// Check immediately
getSession();

// Also listen for storage changes in case they log in while extension is open
window.addEventListener('storage', (e) => {
  if (e.key && (
    (e.key.startsWith('sb-') && e.key.endsWith('-auth-token')) ||
    (e.key.includes('supabase') && e.key.includes('auth'))
  )) {
    getSession();
  }
});

// The storage event does not fire in the same tab that modifies the storage.
// So we also listen for a direct message from the website.
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'REWORD_AUTH_SUCCESS') {
    if (event.data.session) {
      // Website passed session directly, no need to read localStorage!
      chrome.runtime.sendMessage({
        type: 'SESSION_FROM_WEBSITE',
        session: event.data.session
      });
    } else {
      getSession();
    }
  }
});
