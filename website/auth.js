import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// The HTML files will load the UMD build of supabase from CDN before this runs.
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function showError(containerId, message) {
  const container = document.getElementById(containerId);
  if (container) {
    container.textContent = message;
    container.classList.remove('hidden');
  }
}

export function hideError(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.classList.add('hidden');
    container.textContent = '';
  }
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function setBtnLoading(btnId, isLoading, defaultText = '') {
  const btn = document.getElementById(btnId);
  if (btn) {
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Please wait...' : defaultText;
  }
}
