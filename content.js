// Listen for messages from the extension popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getSelectedText") {
    const selection = window.getSelection().toString();
    sendResponse({ text: selection });
  } else if (request.action === "replaceText") {
    try {
      replaceSelectedText(request.text);
      sendResponse({ success: true });
    } catch (err) {
      console.error("Reword replacement failed:", err);
      sendResponse({ success: false, error: err.message });
    }
  }
  return true; // Keep message channel open for async responses
});

/**
 * Replaces the selected text on the active page.
 * Handles inputs, textareas, and contenteditable elements (Gmail, LinkedIn, etc.)
 */
function replaceSelectedText(replacementText) {
  const activeEl = document.activeElement;
  
  // Case 1: Standard input or textarea
  if (activeEl && (activeEl.tagName === "TEXTAREA" || (activeEl.tagName === "INPUT" && (activeEl.type === "text" || activeEl.type === "search")))) {
    const start = activeEl.selectionStart;
    const end = activeEl.selectionEnd;
    const text = activeEl.value;
    
    // Replace selected portion, or insert at cursor if nothing selected
    activeEl.value = text.slice(0, start) + replacementText + text.slice(end);
    
    // Position cursor at the end of the newly inserted text
    const newCursorPos = start + replacementText.length;
    activeEl.selectionStart = newCursorPos;
    activeEl.selectionEnd = newCursorPos;
    
    // Dispatch input and change events so web frameworks (React, Angular, Vue) register the change
    activeEl.dispatchEvent(new Event('input', { bubbles: true }));
    activeEl.dispatchEvent(new Event('change', { bubbles: true }));
  } 
  // Case 2: Rich text editors / contenteditable containers (Gmail, LinkedIn, Slack etc.)
  else {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    
    const range = sel.getRangeAt(0);
    range.deleteContents();
    
    // Create text node and insert it
    const textNode = document.createTextNode(replacementText);
    range.insertNode(textNode);
    
    // Move selection cursor to the end of the inserted node
    const newRange = document.createRange();
    newRange.setStartAfter(textNode);
    newRange.setEndAfter(textNode);
    sel.removeAllRanges();
    sel.addRange(newRange);
    
    // Try to trigger input event on the contenteditable parent element
    let parent = textNode.parentNode;
    while (parent) {
      if (parent.nodeType === Node.ELEMENT_NODE && parent.hasAttribute('contenteditable')) {
        parent.dispatchEvent(new Event('input', { bubbles: true }));
        parent.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
      parent = parent.parentNode;
    }
  }
}
