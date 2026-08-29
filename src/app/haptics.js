// Tap confirmation you can feel without reading the screen. The Vibration
// API is Android-only; iOS falls back to the visual flash the UI pairs with
// every count.

export function buzz(pattern = 18) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported: the visual flash still confirms the tap.
  }
}
