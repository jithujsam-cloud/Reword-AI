import { OPENAI_API_KEY, MODEL, SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// =============================================
// BASE SYSTEM PROMPT (unchanged V1 rules)
// =============================================
const BASE_RULES = `STEP 1 — Detect tone before rewriting.

Read the email and classify it as one of three types:

CASUAL: Email to a startup founder, SDR, agency owner, or informal business contact. Subject lines are relaxed. Greeting is "Hey" or "Hi [first name]".

PROFESSIONAL: Email to a manager, director, mid-size company contact, or standard business email. Greeting is "Hi [Name]" or "Hello [Name]".

FORMAL: Email to enterprise, legal, government, HR, finance, or senior executive. Greeting is "Dear [Name]" or "Dear Mr/Ms [Name]".

STEP 2 — Rewrite based on detected tone.

If CASUAL:
- Short sentences. Under 10 words each.
- Contractions always. "I'm" not "I am".
- Informal sign-off. "Talk soon" / "lmk" / "cheers"
- No bullet points. No formal structure.

If PROFESSIONAL:
- Short clear sentences. Under 15 words.
- Contractions where natural. "I'd" / "we'd" / "it's"
- Polite but direct. No fluff.
- Sign-off: "Thanks" / "Best" / "Speak soon"
- No "lmk". No "cheers". No slang.

If FORMAL:
- Complete sentences. Respectful tone throughout.
- Minimal contractions. But still clear and simple.
- No slang whatsoever.
- Sign-off: "Kind regards" / "Best regards" / "Yours sincerely"
- Still remove all AI tells — just keep the formality.

RULE FOR ALL THREE:
- Never change the meaning
- Never add length
- Always remove the AI tells from the rules below
- Sound like a real human wrote it for that context

---

ADDITIONAL REWRITE RULES — apply to all tone types:

1. Remove ALL em dashes (—). Replace with a comma or split into two sentences.
2. Remove ALL semicolons. Make them separate sentences.
3. Remove oxford commas (comma before 'and' in a list).
4. Replace these phrases:
   'I wanted to reach out' → start the sentence differently
   'I hope this email finds you well' → delete it entirely
   'synergies' → 'ways to work together'
   'delve' → 'look into'
   'moving forward' → delete or use 'going forward' casually
   'at your earliest convenience' → 'when you get a chance'
   'as per our conversation' → 'as we discussed'
   'it's not X, it's Y' → rewrite the whole sentence simply
   'utilize' → 'use'
   'leverage' → 'use'
   'touch base' → 'catch up'
   'circle back' → 'follow up'
5. Keep sentences short. Under 15 words each where possible.
6. Use grade 8 English. Simple vocabulary only.
7. Do NOT add typos.
8. Do NOT change the meaning or remove key information.
9. Do NOT make it longer than the original.
10. Sound like someone typing a WhatsApp message to a work contact.
11. Never start a sentence with "I wanted to". Rewrite as a direct statement instead.
    Example: "I wanted to discuss" → "Let's discuss". "I wanted to share" → "Here's..." or "Just sharing...".
12. Replace "I look forward to connecting" (and similar phrases like "I look forward to hearing from you") with something casual like "talk soon" or remove it entirely.
13. Replace "exciting opportunity" with something specific or just "this".
14. End emails simply. Use "Thanks", "lmk", or nothing at all. Never use "Thank you for your consideration" or similar formal sign-offs.
15. Remove "I'm eager to" — replace with something direct. "Want to" or just state the action.
16. Never say "value propositions" — say "what we both offer" or just remove it.
17. "not just about X" pattern — if it appears in any form, rewrite the whole sentence simply.`;

// =============================================
// FINGERPRINT → PROMPT SECTION
// =============================================
function buildFingerprintPrompt(fingerprint) {
  if (!fingerprint) return '';

  let lines = ['\n\nSTYLE FINGERPRINT — Match the user\'s personal writing patterns:'];

  if (fingerprint.avg_sentence_length) {
    lines.push(`- Target sentence length: ~${fingerprint.avg_sentence_length} words per sentence`);
  }
  if (fingerprint.vocabulary_level) {
    lines.push(`- Vocabulary level: ${fingerprint.vocabulary_level}`);
  }
  if (fingerprint.common_greetings?.length > 0) {
    lines.push(`- Use greetings like: ${fingerprint.common_greetings.join(', ')}`);
  }
  if (fingerprint.common_signoffs?.length > 0) {
    lines.push(`- Use sign-offs like: ${fingerprint.common_signoffs.join(', ')}`);
  }
  if (fingerprint.punctuation_habits) {
    const h = fingerprint.punctuation_habits;
    const habits = [];
    if (h.uses_em_dashes) habits.push('uses em dashes');
    if (!h.uses_em_dashes) habits.push('avoids em dashes');
    if (h.uses_semicolons) habits.push('uses semicolons');
    if (!h.uses_semicolons) habits.push('avoids semicolons');
    if (h.uses_exclamation_marks) habits.push('uses exclamation marks');
    if (h.uses_ellipses) habits.push('uses ellipses');
    if (!h.uses_oxford_comma) habits.push('no oxford comma');
    lines.push(`- Punctuation: ${habits.join(', ')}`);
  }
  if (fingerprint.contraction_preference) {
    lines.push(`- Contractions: ${fingerprint.contraction_preference}`);
  }
  if (fingerprint.formality_level) {
    lines.push(`- Formality: ${fingerprint.formality_level}`);
  }
  if (fingerprint.sentence_structure) {
    lines.push(`- Sentence structure: ${fingerprint.sentence_structure}`);
  }
  if (fingerprint.distinctive_phrases?.length > 0) {
    lines.push(`- Incorporate natural phrases like: "${fingerprint.distinctive_phrases.join('", "')}"`);
  }
  if (fingerprint.tone_markers?.length > 0) {
    lines.push(`- Overall tone: ${fingerprint.tone_markers.join(', ')}`);
  }
  if (fingerprint.paragraph_length) {
    lines.push(`- Paragraph length: ${fingerprint.paragraph_length}`);
  }

  return lines.join('\n');
}

function buildAvoidancePrompt(rules) {
  if (!rules || rules.length === 0) return '';

  let lines = ['\n\nAVOIDANCE RULES — The user has indicated they dislike these patterns. NEVER use them:'];
  rules.forEach((rule, i) => {
    lines.push(`${i + 1}. ${rule}`);
  });

  return lines.join('\n');
}

// =============================================
// SUPABASE HELPER (lightweight, no full SDK in service worker)
// =============================================
async function supabaseGet(table, params, accessToken) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) throw new Error(`Supabase GET error: ${res.status}`);
  return res.json();
}

async function supabaseInsert(table, data, accessToken) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Supabase INSERT error: ${res.status} ${errBody}`);
  }
  return res.json();
}

async function supabaseUpdate(table, data, params, accessToken) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Supabase PATCH error: ${res.status} ${errBody}`);
  }
  return res.json();
}

// =============================================
// SELF-CORRECTION ENGINE
// =============================================
const CORRECTION_THRESHOLD = 10;

async function runSelfCorrection(personaId, accessToken) {
  try {
    // Fetch persona to check thresholds
    const personas = await supabaseGet(
      'personas',
      `id=eq.${personaId}&select=rejected_count,last_correction_at,avoidance_rules`,
      accessToken
    );

    if (!personas || personas.length === 0) return;
    const persona = personas[0];

    // Check if we should run correction
    const rejectedSinceLastCorrection = persona.rejected_count || 0;
    if (rejectedSinceLastCorrection < CORRECTION_THRESHOLD) return;

    // Check debounce — don't run if last correction was < 10 rejections ago
    // We use the modulo: only run at multiples of CORRECTION_THRESHOLD
    if (rejectedSinceLastCorrection % CORRECTION_THRESHOLD !== 0) return;

    // Fetch the last 10 rejected rewrites
    const feedbackRows = await supabaseGet(
      'feedback_log',
      `persona_id=eq.${personaId}&signal=eq.rejected&select=rewritten_text&order=created_at.desc&limit=10`,
      accessToken
    );

    if (!feedbackRows || feedbackRows.length < CORRECTION_THRESHOLD) return;

    const rejectedTexts = feedbackRows.map((r, i) => `${i + 1}. ${r.rewritten_text}`).join('\n');

    // Call OpenAI to analyze patterns
    const correctionPrompt = `You are a Writing Preference Analyst. The user has REJECTED the following ${feedbackRows.length} AI-rewritten outputs. Analyze them and identify specific patterns, words, phrases, or stylistic choices that the user consistently dislikes.

REJECTED OUTPUTS:
${rejectedTexts}

Return a JSON array of specific, actionable avoidance rules. Each rule should be a short instruction the AI can follow.
Example: ["Never use the word 'cheers' as a sign-off", "Avoid starting sentences with 'I wanted to'", "Don't use bullet points"]

Output JSON array only, no markdown fences, no explanation.`;

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: correctionPrompt }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!openaiRes.ok) return;

    const openaiData = await openaiRes.json();
    const raw = openaiData.choices[0].message.content.trim();
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

    let newRules;
    try {
      newRules = JSON.parse(cleaned);
    } catch (e) {
      console.error('Self-correction: failed to parse rules', e);
      return;
    }

    if (!Array.isArray(newRules) || newRules.length === 0) return;

    // Merge with existing rules (deduplicate)
    const existing = persona.avoidance_rules || [];
    const merged = [...new Set([...existing, ...newRules])];

    // Update persona
    await supabaseUpdate(
      'personas',
      {
        avoidance_rules: merged,
        last_correction_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      `id=eq.${personaId}`,
      accessToken
    );

    console.log(`[Reword] Self-correction: added ${newRules.length} avoidance rules to persona ${personaId}`);
  } catch (err) {
    console.error('[Reword] Self-correction error:', err);
  }
}

// =============================================
// MESSAGE HANDLER
// =============================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Session bridge from website
  if (request.type === 'SESSION_FROM_WEBSITE') {
    const session = request.session;
    if (session && session.user) {
      chrome.storage.local.set({
        supabase_user_id: session.user.id,
        user_email: session.user.email,
        supabase_session: session
      });
    }
    return false;
  }

  // =============================================
  // REWRITE TEXT (V2: with persona fingerprint)
  // =============================================
  if (request.action === "rewriteText") {
    const textToRewrite = request.text;

    // Check if API key is configured
    if (!OPENAI_API_KEY || OPENAI_API_KEY === "YOUR_API_KEY_HERE" || OPENAI_API_KEY.trim() === "") {
      sendResponse({
        success: false,
        error: "OpenAI API Key not configured. Please fill in your API key inside config.js."
      });
      return true;
    }

    const tone = request.tone || "Professional";
    const personaId = request.personaId || null;

    // Build the prompt (async because we may need to fetch persona data)
    (async () => {
      let fingerprintSection = '';
      let avoidanceSection = '';

      if (personaId) {
        try {
          // Get access token from storage
          const storageData = await chrome.storage.local.get(['supabase_session']);
          const accessToken = storageData.supabase_session?.access_token;

          const personas = await supabaseGet(
            'personas',
            `id=eq.${personaId}&select=style_fingerprint,avoidance_rules`,
            accessToken
          );

          if (personas && personas.length > 0) {
            const persona = personas[0];
            fingerprintSection = buildFingerprintPrompt(persona.style_fingerprint);
            avoidanceSection = buildAvoidancePrompt(persona.avoidance_rules);
          }
        } catch (err) {
          console.warn('[Reword] Could not fetch persona data, proceeding without fingerprint:', err.message);
        }
      }

      const systemPrompt = BASE_RULES
        + "\n\nCRITICAL OVERRIDE: The user has selected their preferred tone as: " + tone.toUpperCase() + ". You MUST ignore auto-detection and write the rewrite using ONLY the " + tone.toUpperCase() + " rules."
        + fingerprintSection
        + avoidanceSection;

      // Call OpenAI API
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: textToRewrite }
            ],
            max_tokens: 1000,
            temperature: 0.7
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const apiMessage = errorData.error?.message || null;

          let userMessage;
          switch (response.status) {
            case 401:
              userMessage = "Invalid API key. Please check the key in config.js and make sure it is correct.";
              break;
            case 403:
              userMessage = "Access denied. Your API key may not have permission to use this model.";
              break;
            case 429:
              userMessage = "Rate limit reached or credits exhausted. Please wait a moment and try again.";
              break;
            case 500:
              userMessage = "OpenAI is experiencing issues right now. Please try again in a few seconds.";
              break;
            default:
              userMessage = apiMessage || `Unexpected error from OpenAI API (HTTP ${response.status}).`;
          }
          sendResponse({ success: false, error: userMessage });
          return;
        }

        const data = await response.json();
        const result = data.choices[0].message.content;

        if (!result) {
          sendResponse({ success: false, error: "OpenAI returned an empty response. Please try again." });
          return;
        }

        // Increment total_rewrites on the persona if we have one
        if (personaId) {
          try {
            const storageData = await chrome.storage.local.get(['supabase_session']);
            const accessToken = storageData.supabase_session?.access_token;

            // Fetch current count then increment
            const personas = await supabaseGet('personas', `id=eq.${personaId}&select=total_rewrites`, accessToken);
            if (personas && personas.length > 0) {
              await supabaseUpdate(
                'personas',
                { total_rewrites: (personas[0].total_rewrites || 0) + 1, updated_at: new Date().toISOString() },
                `id=eq.${personaId}`,
                accessToken
              );
            }
          } catch (e) {
            console.warn('[Reword] Could not increment rewrite count:', e.message);
          }
        }

        sendResponse({
          success: true,
          rewrittenText: result,
          originalText: textToRewrite,
          personaId: personaId
        });

      } catch (err) {
        const isNetworkError = !err.statusCode && (
          err.message.includes("Failed to fetch") ||
          err.message.includes("NetworkError") ||
          err.message.includes("Load failed")
        );

        const finalMessage = isNetworkError
          ? "Network error — could not reach OpenAI API. Please check your internet connection."
          : err.message || "An unknown error occurred while contacting OpenAI API.";

        console.error("OpenAI API error:", err);
        sendResponse({ success: false, error: finalMessage });
      }
    })();

    return true; // Keep message channel open for async sendResponse
  }

  // =============================================
  // LOG FEEDBACK (V2)
  // =============================================
  if (request.action === "logFeedback") {
    (async () => {
      try {
        const storageData = await chrome.storage.local.get(['supabase_session', 'supabase_user_id']);
        const accessToken = storageData.supabase_session?.access_token;
        const userId = storageData.supabase_user_id;

        if (!userId || !accessToken) {
          sendResponse({ success: false, error: 'Not authenticated' });
          return;
        }

        const feedbackData = {
          user_id: userId,
          persona_id: request.personaId || null,
          original_text: request.originalText || '',
          rewritten_text: request.rewrittenText || '',
          signal: request.signal // 'accepted' or 'rejected'
        };

        await supabaseInsert('feedback_log', feedbackData, accessToken);

        // Update persona counters
        if (request.personaId) {
          const field = request.signal === 'accepted' ? 'accepted_count' : 'rejected_count';

          const personas = await supabaseGet(
            'personas',
            `id=eq.${request.personaId}&select=${field}`,
            accessToken
          );

          if (personas && personas.length > 0) {
            const currentCount = personas[0][field] || 0;
            await supabaseUpdate(
              'personas',
              { [field]: currentCount + 1, updated_at: new Date().toISOString() },
              `id=eq.${request.personaId}`,
              accessToken
            );

            // Check if self-correction should run (only on rejections)
            if (request.signal === 'rejected') {
              runSelfCorrection(request.personaId, accessToken);
            }
          }
        }

        sendResponse({ success: true });
      } catch (err) {
        console.error('[Reword] Feedback logging error:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();

    return true;
  }
});
