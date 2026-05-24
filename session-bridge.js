// session-bridge.js
const getSession = async () => {
  const keys = Object.keys(localStorage);
  const sessionKey = keys.find(k => 
    k.includes('supabase') && 
    k.includes('auth')
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
  if (e.key && e.key.includes('supabase') && e.key.includes('auth')) {
    getSession();
  }
});
