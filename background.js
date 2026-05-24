import { OPENAI_API_KEY, MODEL } from './config.js';

const SYSTEM_PROMPT = `STEP 1 — Detect tone before rewriting.

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


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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

    // Call OpenAI API
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT
          },
          {
            role: "user",
            content: textToRewrite
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    })
    .then(async (response) => {
      if (!response.ok) {
        // Attempt to extract the API error body for context
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

        const err = new Error(userMessage);
        err.statusCode = response.status;
        throw err;
      }
      return response.json();
    })
    .then((data) => {
      const result = data.choices[0].message.content;
      if (result) {
        sendResponse({ success: true, rewrittenText: result });
      } else {
        throw new Error("OpenAI returned an empty response. Please try again.");
      }
    })
    .catch((err) => {
      // Network-level failure (no internet, DNS failure, CORS block, etc.)
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
    });

    return true; // Keep message channel open for sendResponse
  }
});
