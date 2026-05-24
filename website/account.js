import { supabase, setBtnLoading } from './auth.js';

let currentUser = null;

async function initAccount() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = 'signin.html';
    return;
  }

  currentUser = session.user;
  
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('dashboard-content').style.display = 'block';

  // Populate basic auth info
  document.getElementById('email').value = currentUser.email;
  
  const joinedDate = new Date(currentUser.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  document.getElementById('member-since').textContent = `Member since ${joinedDate}`;

  // Fetch user profile from public.users
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('supabase_user_id', currentUser.id)
    .single();

  if (profile) {
    // Account Section
    const fullName = profile.full_name || '';
    document.getElementById('full_name').value = fullName;
    
    updateAvatar(fullName, currentUser.email);

    // Plan Section
    const plan = profile.plan || 'free';
    const used = profile.rewrites_used || 0;
    const limit = profile.rewrites_limit || 3;

    const planBadge = document.getElementById('plan-badge');
    const planDesc = document.getElementById('plan-desc');
    const planActions = document.getElementById('plan-actions');
    const usageText = document.getElementById('usage-text');
    const usageProgress = document.getElementById('usage-progress');

    if (plan === 'free') {
      planBadge.className = 'badge badge-free';
      planBadge.textContent = 'Free Plan';
      planDesc.textContent = '3 rewrites per month';
      planActions.innerHTML = `<a href="https://dodo.pe/zqg57npt9js" target="_blank" class="btn btn-primary">Upgrade to Pro &rarr;</a>`;
      
      usageText.textContent = `${used} / ${limit}`;
      usageProgress.style.width = `${Math.min((used / limit) * 100, 100)}%`;
    } else {
      planBadge.className = 'badge badge-pro';
      planBadge.textContent = 'Pro Plan ✓';
      planDesc.textContent = 'Unlimited rewrites';
      planActions.innerHTML = `<a href="https://dodo.pe/zqg57npt9js" target="_blank" class="btn btn-outline" style="border-color: var(--border);">Manage Subscription</a>`;
      
      usageText.textContent = `${used} (Unlimited)`;
      usageProgress.style.width = `100%`;
      usageProgress.style.backgroundColor = 'var(--green-light)';
    }

    // Extension Section
    const lastSynced = profile.last_synced_at;
    const extBadge = document.getElementById('extension-badge');
    const lastSyncedText = document.getElementById('last-synced');
    
    if (lastSynced) {
      const syncDate = new Date(lastSynced);
      const isRecentlySynced = (Date.now() - syncDate.getTime()) < 1000 * 60 * 60 * 24 * 7; // within 7 days
      
      extBadge.className = isRecentlySynced ? 'badge badge-connected' : 'badge badge-disconnected';
      extBadge.textContent = isRecentlySynced ? 'Connected' : 'Disconnected';
      lastSyncedText.textContent = `Last synced: ${syncDate.toLocaleDateString()} ${syncDate.toLocaleTimeString()}`;
    } else {
      extBadge.className = 'badge badge-disconnected';
      extBadge.textContent = 'Not connected';
      lastSyncedText.textContent = 'Last synced: Never';
    }

    // Preferences Section
    const defaultTone = profile.default_tone || 'Professional';
    document.getElementById('default_tone').value = defaultTone;
  } else {
    updateAvatar('', currentUser.email);
  }
}

function updateAvatar(fullName, email) {
  const avatar = document.getElementById('user-avatar');
  const display = document.getElementById('display-name');
  
  if (fullName && fullName.trim().length > 0) {
    const parts = fullName.trim().split(' ');
    let initials = parts[0].charAt(0).toUpperCase();
    if (parts.length > 1) {
      initials += parts[parts.length - 1].charAt(0).toUpperCase();
    }
    avatar.textContent = initials;
    display.textContent = fullName;
  } else {
    avatar.textContent = email.charAt(0).toUpperCase();
    display.textContent = email.split('@')[0];
  }
}

// 1. Save Account Form
document.getElementById('form-account').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btnId = 'btn-save-account';
  setBtnLoading(btnId, true, 'Save Account Details');
  
  const msgEl = document.getElementById('account-msg');
  msgEl.textContent = '';
  
  const fullName = document.getElementById('full_name').value.trim();
  const newPassword = document.getElementById('password').value;

  try {
    // Update DB
    const { error: dbError } = await supabase
      .from('users')
      .update({ full_name: fullName })
      .eq('supabase_user_id', currentUser.id);

    if (dbError) throw dbError;

    // Update Password if provided
    if (newPassword && newPassword.length >= 6) {
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (authError) throw authError;
      document.getElementById('password').value = '';
    }

    updateAvatar(fullName, currentUser.email);
    msgEl.style.color = 'var(--green)';
    msgEl.textContent = 'Account details saved successfully.';
  } catch (error) {
    msgEl.style.color = 'var(--red-text)';
    msgEl.textContent = error.message;
  } finally {
    setBtnLoading(btnId, false, 'Save Account Details');
    setTimeout(() => { msgEl.textContent = ''; }, 3000);
  }
});

// 2. Save Preferences Form
document.getElementById('form-preferences').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btnId = 'btn-save-prefs';
  setBtnLoading(btnId, true, 'Save Preferences');
  
  const msgEl = document.getElementById('prefs-msg');
  msgEl.textContent = '';
  
  const tone = document.getElementById('default_tone').value;

  try {
    const { error } = await supabase
      .from('users')
      .update({ default_tone: tone })
      .eq('supabase_user_id', currentUser.id);

    if (error) throw error;

    msgEl.style.color = 'var(--green)';
    msgEl.textContent = 'Preferences saved successfully.';
  } catch (error) {
    msgEl.style.color = 'var(--red-text)';
    msgEl.textContent = error.message;
  } finally {
    setBtnLoading(btnId, false, 'Save Preferences');
    setTimeout(() => { msgEl.textContent = ''; }, 3000);
  }
});

// 3. Danger Zone
document.getElementById('btn-signout').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
});

document.getElementById('btn-delete-account').addEventListener('click', async () => {
  const confirmed = confirm('Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.');
  if (confirmed) {
    const btn = document.getElementById('btn-delete-account');
    btn.disabled = true;
    btn.textContent = 'Deleting...';
    
    try {
      // Call the RPC function we created in schema.sql
      const { error } = await supabase.rpc('delete_user');
      if (error) throw error;
      
      await supabase.auth.signOut();
      alert('Your account has been deleted.');
      window.location.href = 'index.html';
    } catch (error) {
      alert('Error deleting account: ' + error.message);
      btn.disabled = false;
      btn.textContent = 'Delete Account';
    }
  }
});

initAccount();
