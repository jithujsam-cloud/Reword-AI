import { supabase } from './auth.js';

// =============================================
// CONFIG
// =============================================
const OPENAI_API_KEY = 'YOUR_API_KEY_HERE';
const OPENAI_MODEL = 'gpt-4o-mini';
const MAX_SAMPLES = 5;
const MIN_SAMPLES = 3;

// =============================================
// STATE
// =============================================
let currentUser = null;
let personas = [];
let sampleCount = 3; // start with 3 sample fields

// =============================================
// DOM REFS
// =============================================
const personasGrid = document.getElementById('personas-grid');
const emptyState = document.getElementById('empty-state');
const personaModal = document.getElementById('persona-modal');
const deleteModal = document.getElementById('delete-modal');

// =============================================
// INIT
// =============================================
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'signin.html';
    return;
  }
  currentUser = session.user;
  await loadPersonas();
}

// =============================================
// LOAD & RENDER PERSONAS
// =============================================
async function loadPersonas() {
  const { data, error } = await supabase
    .from('personas')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error loading personas:', error);
    return;
  }

  personas = data || [];
  renderPersonas();
}

function renderPersonas() {
  if (personas.length === 0) {
    personasGrid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  personasGrid.innerHTML = personas.map(p => renderPersonaCard(p)).join('');

  // Bind card action buttons
  personasGrid.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'edit') openEditModal(id);
      else if (action === 'delete') openDeleteModal(id);
      else if (action === 'set-default') setDefault(id);
    });
  });
}

function renderPersonaCard(p) {
  const totalFeedback = p.accepted_count + p.rejected_count;
  const acceptanceRate = totalFeedback > 0 ? Math.round((p.accepted_count / totalFeedback) * 100) : 0;
  const rateClass = acceptanceRate >= 70 ? 'high' : acceptanceRate >= 40 ? 'medium' : 'low';
  const hasFp = p.style_fingerprint !== null;
  const toneClass = p.tone.toLowerCase();

  return `
    <div class="persona-card ${p.is_default ? 'is-default' : ''}">
      <div class="persona-card-header">
        <div class="persona-name-group">
          <span class="persona-name">${escapeHtml(p.name)}</span>
          ${p.is_default ? '<span class="persona-default-star" title="Default">★</span>' : ''}
        </div>
        <div class="persona-actions">
          ${!p.is_default ? `<button class="persona-action-btn" data-action="set-default" data-id="${p.id}" title="Set as default">☆</button>` : ''}
          <button class="persona-action-btn" data-action="edit" data-id="${p.id}" title="Edit">✏️</button>
          <button class="persona-action-btn" data-action="delete" data-id="${p.id}" title="Delete">🗑️</button>
        </div>
      </div>
      <div class="tone-badge ${toneClass}">${p.tone}</div>
      <div class="fingerprint-status">
        <div class="fingerprint-dot ${hasFp ? 'trained' : 'untrained'}"></div>
        ${hasFp ? 'Voice trained' : 'Not trained yet'}
      </div>
      ${p.avoidance_rules && p.avoidance_rules.length > 0 ? `
        <div class="fingerprint-status" style="margin-bottom:16px;">
          <div class="fingerprint-dot trained" style="background:#d97706;"></div>
          ${p.avoidance_rules.length} avoidance rule${p.avoidance_rules.length > 1 ? 's' : ''} active
        </div>
      ` : ''}
      <div class="persona-stats">
        <div class="persona-stat">
          <span class="persona-stat-value">${p.total_rewrites}</span>
          <span class="persona-stat-label">Rewrites</span>
        </div>
        <div class="persona-stat">
          <span class="persona-stat-value">${totalFeedback > 0 ? acceptanceRate + '%' : '—'}</span>
          <span class="persona-stat-label">Acceptance</span>
          ${totalFeedback > 0 ? `
            <div class="acceptance-bar-bg">
              <div class="acceptance-bar-fill ${rateClass}" style="width:${acceptanceRate}%"></div>
            </div>
          ` : ''}
        </div>
        <div class="persona-stat">
          <span class="persona-stat-value">${totalFeedback}</span>
          <span class="persona-stat-label">Feedback</span>
        </div>
      </div>
    </div>
  `;
}

// =============================================
// MODAL: CREATE / EDIT
// =============================================
function openCreateModal() {
  document.getElementById('modal-title').textContent = 'New Persona';
  document.getElementById('edit-persona-id').value = '';
  document.getElementById('persona-name').value = '';
  document.getElementById('persona-default').checked = personas.length === 0;
  document.getElementById('btn-train-persona').textContent = 'Train & Save Persona';

  // Reset tone
  document.querySelectorAll('.tone-chip').forEach(c => c.classList.remove('active'));
  document.querySelector('.tone-chip[data-tone="Professional"]').classList.add('active');

  // Reset samples
  sampleCount = 3;
  renderSampleFields([]);

  // Hide fingerprint
  document.getElementById('fingerprint-section').classList.add('hidden');
  document.getElementById('training-status').classList.add('hidden');

  personaModal.classList.add('active');
}

function openEditModal(id) {
  const p = personas.find(x => x.id === id);
  if (!p) return;

  document.getElementById('modal-title').textContent = 'Edit Persona';
  document.getElementById('edit-persona-id').value = p.id;
  document.getElementById('persona-name').value = p.name;
  document.getElementById('persona-default').checked = p.is_default;
  document.getElementById('btn-train-persona').textContent = 'Retrain & Save';

  // Set tone
  document.querySelectorAll('.tone-chip').forEach(c => c.classList.remove('active'));
  const toneChip = document.querySelector(`.tone-chip[data-tone="${p.tone}"]`);
  if (toneChip) toneChip.classList.add('active');

  // Set samples
  const samples = p.training_samples || [];
  sampleCount = Math.max(MIN_SAMPLES, samples.length);
  renderSampleFields(samples);

  // Show fingerprint if exists
  if (p.style_fingerprint) {
    document.getElementById('fingerprint-section').classList.remove('hidden');
    document.getElementById('fingerprint-preview').textContent = JSON.stringify(p.style_fingerprint, null, 2);
  } else {
    document.getElementById('fingerprint-section').classList.add('hidden');
  }

  document.getElementById('training-status').classList.add('hidden');
  personaModal.classList.add('active');
}

function closeModal() {
  personaModal.classList.remove('active');
}

function renderSampleFields(existingValues) {
  const container = document.getElementById('samples-container');
  container.innerHTML = '';
  for (let i = 0; i < sampleCount; i++) {
    const val = existingValues[i] || '';
    container.innerHTML += `
      <div class="sample-item">
        <div class="sample-header">
          <span class="sample-label">Sample ${i + 1}</span>
          ${i >= MIN_SAMPLES ? `<button type="button" class="btn-remove-sample" data-index="${i}">✕</button>` : ''}
        </div>
        <textarea class="sample-textarea" placeholder="Paste an email or message you've written..." data-sample="${i}">${escapeHtml(val)}</textarea>
      </div>
    `;
  }

  // Bind remove buttons
  container.querySelectorAll('.btn-remove-sample').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const values = getSampleValues();
      values.splice(idx, 1);
      sampleCount--;
      renderSampleFields(values);
    });
  });
}

function getSampleValues() {
  return Array.from(document.querySelectorAll('.sample-textarea'))
    .map(ta => ta.value.trim());
}

function getSelectedTone() {
  const active = document.querySelector('.tone-chip.active');
  return active ? active.dataset.tone : 'Professional';
}

// =============================================
// TRAIN PERSONA (OpenAI Fingerprint Extraction)
// =============================================
async function trainAndSave() {
  const name = document.getElementById('persona-name').value.trim();
  const tone = getSelectedTone();
  const isDefault = document.getElementById('persona-default').checked;
  const editId = document.getElementById('edit-persona-id').value;
  const samples = getSampleValues().filter(s => s.length > 0);

  // Validation
  if (!name) {
    alert('Please enter a persona name.');
    return;
  }
  if (samples.length < MIN_SAMPLES) {
    alert(`Please provide at least ${MIN_SAMPLES} writing samples.`);
    return;
  }

  const trainBtn = document.getElementById('btn-train-persona');
  const statusEl = document.getElementById('training-status');

  // Show training in progress
  trainBtn.disabled = true;
  trainBtn.textContent = 'Training...';
  statusEl.classList.remove('hidden');
  statusEl.className = 'training-status in-progress';
  statusEl.innerHTML = '<div class="training-spinner"></div> Analyzing your writing style...';

  let fingerprint = null;
  try {
    fingerprint = await extractFingerprint(samples);
  } catch (err) {
    console.error('Fingerprint extraction error:', err);
    statusEl.className = 'training-status';
    statusEl.style.background = 'var(--error-container)';
    statusEl.style.color = 'var(--on-error-container)';
    statusEl.innerHTML = `⚠️ Training failed: ${err.message}`;
    trainBtn.disabled = false;
    trainBtn.textContent = editId ? 'Retrain & Save' : 'Train & Save Persona';
    return;
  }

  // Show fingerprint
  document.getElementById('fingerprint-section').classList.remove('hidden');
  document.getElementById('fingerprint-preview').textContent = JSON.stringify(fingerprint, null, 2);
  statusEl.className = 'training-status complete';
  statusEl.innerHTML = '✓ Style fingerprint extracted. Saving...';

  // Save to Supabase
  const personaData = {
    user_id: currentUser.id,
    name,
    tone,
    training_samples: samples,
    style_fingerprint: fingerprint,
    is_default: isDefault,
    updated_at: new Date().toISOString()
  };

  try {
    if (editId) {
      const { error } = await supabase
        .from('personas')
        .update(personaData)
        .eq('id', editId)
        .eq('user_id', currentUser.id);
      if (error) throw error;
    } else {
      personaData.created_at = new Date().toISOString();
      const { error } = await supabase
        .from('personas')
        .insert(personaData);
      if (error) throw error;
    }

    statusEl.innerHTML = '✓ Persona saved successfully!';
    setTimeout(() => {
      closeModal();
      loadPersonas();
    }, 800);
  } catch (err) {
    console.error('Save error:', err);
    statusEl.className = 'training-status';
    statusEl.style.background = 'var(--error-container)';
    statusEl.style.color = 'var(--on-error-container)';
    statusEl.innerHTML = `⚠️ Save failed: ${err.message}`;
  } finally {
    trainBtn.disabled = false;
    trainBtn.textContent = editId ? 'Retrain & Save' : 'Train & Save Persona';
  }
}

async function extractFingerprint(samples) {
  const samplesText = samples.map((s, i) => `--- SAMPLE ${i + 1} ---\n${s}`).join('\n\n');

  const systemPrompt = `You are a Writing Style Analyst. Analyze the following writing samples from the same author and extract a precise Style Fingerprint.

Examine these patterns carefully:
- Average sentence length (count words per sentence across all samples)
- Vocabulary level (grade_school, conversational, professional, academic)
- Common greetings used (e.g., "Hey", "Hi there", "Dear")
- Common sign-offs used (e.g., "Thanks", "Cheers", "Best")
- Punctuation habits (em dashes, semicolons, exclamation marks, ellipses, oxford commas)
- Contraction preference (always, sometimes, never)
- Formality level (very_casual, casual, neutral, formal, very_formal)
- Sentence structure (simple, compound, complex, varied)
- Distinctive phrases or speech patterns
- Overall tone markers (direct, warm, concise, verbose, etc.)
- Paragraph length tendency (short, medium, long)
- List/bullet usage (frequent, occasional, never)

OUTPUT FORMAT — Return ONLY a valid JSON object, no markdown fences, no explanation:
{
  "avg_sentence_length": <number>,
  "vocabulary_level": "<grade_school|conversational|professional|academic>",
  "common_greetings": ["..."],
  "common_signoffs": ["..."],
  "punctuation_habits": {
    "uses_em_dashes": <boolean>,
    "uses_semicolons": <boolean>,
    "uses_exclamation_marks": <boolean>,
    "uses_ellipses": <boolean>,
    "uses_oxford_comma": <boolean>
  },
  "contraction_preference": "<always|sometimes|never>",
  "formality_level": "<very_casual|casual|neutral|formal|very_formal>",
  "sentence_structure": "<simple|compound|complex|varied>",
  "distinctive_phrases": ["..."],
  "tone_markers": ["..."],
  "paragraph_length": "<short|medium|long>",
  "list_usage": "<frequent|occasional|never>"
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: samplesText }
      ],
      temperature: 0.3,
      max_tokens: 800
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `OpenAI API error (HTTP ${response.status})`);
  }

  const data = await response.json();
  const raw = data.choices[0].message.content.trim();

  // Strip markdown fences if the model wraps them
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error('Failed to parse AI response as JSON. Please try again.');
  }
}

// =============================================
// DELETE PERSONA
// =============================================
function openDeleteModal(id) {
  const p = personas.find(x => x.id === id);
  if (!p) return;

  document.getElementById('delete-persona-id').value = p.id;
  document.getElementById('delete-persona-name').textContent = p.name;
  deleteModal.classList.add('active');
}

function closeDeleteModal() {
  deleteModal.classList.remove('active');
}

async function confirmDelete() {
  const id = document.getElementById('delete-persona-id').value;
  const btn = document.getElementById('btn-delete-confirm');
  btn.disabled = true;
  btn.textContent = 'Deleting...';

  try {
    // Delete associated feedback first
    await supabase
      .from('feedback_log')
      .delete()
      .eq('persona_id', id)
      .eq('user_id', currentUser.id);

    // Delete persona
    const { error } = await supabase
      .from('personas')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id);

    if (error) throw error;

    closeDeleteModal();
    await loadPersonas();
  } catch (err) {
    console.error('Delete error:', err);
    alert('Failed to delete persona: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Delete Persona';
  }
}

// =============================================
// SET DEFAULT
// =============================================
async function setDefault(id) {
  try {
    const { error } = await supabase
      .from('personas')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', currentUser.id);

    if (error) throw error;
    await loadPersonas();
  } catch (err) {
    console.error('Set default error:', err);
  }
}

// =============================================
// UTILITIES
// =============================================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// =============================================
// EVENT LISTENERS
// =============================================
document.getElementById('btn-create-persona').addEventListener('click', openCreateModal);
document.getElementById('btn-create-first').addEventListener('click', openCreateModal);
document.getElementById('btn-modal-close').addEventListener('click', closeModal);
document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
document.getElementById('btn-train-persona').addEventListener('click', trainAndSave);

document.getElementById('btn-delete-close').addEventListener('click', closeDeleteModal);
document.getElementById('btn-delete-cancel').addEventListener('click', closeDeleteModal);
document.getElementById('btn-delete-confirm').addEventListener('click', confirmDelete);

// Tone chip selector
document.querySelectorAll('.tone-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.tone-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });
});

// Add sample button
document.getElementById('btn-add-sample').addEventListener('click', () => {
  if (sampleCount >= MAX_SAMPLES) {
    alert(`Maximum ${MAX_SAMPLES} samples allowed.`);
    return;
  }
  const values = getSampleValues();
  sampleCount++;
  renderSampleFields(values);
});

// Close modals on overlay click
personaModal.addEventListener('click', (e) => {
  if (e.target === personaModal) closeModal();
});
deleteModal.addEventListener('click', (e) => {
  if (e.target === deleteModal) closeDeleteModal();
});

// Sign out
document.getElementById('btn-signout').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
});

// =============================================
// BOOT
// =============================================
init();
