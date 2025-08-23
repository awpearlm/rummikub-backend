// Safe Events Helper Functions
function addSafeEventListener(elementId, eventType, callback) {
    const element = document.getElementById(elementId);
    if (element) {
        element.addEventListener(eventType, callback);
        return true;
    } else {
        console.warn(`⚠️ Element not found: ${elementId}`);
        return false;
    }
}

// Function to safely get element by ID with null check
function safeGetElementById(elementId) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`⚠️ Element not found: ${elementId}`);
    }
    return element;
}
