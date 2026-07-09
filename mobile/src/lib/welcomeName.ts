// Locally remembered display name, used only for the "Welcome back, <name>"
// greeting on the sign-in screen. Deliberately survives logout (that's the
// point of the greeting) and is never sent to the backend from here.
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "fittrack:welcome-name";

export async function getWelcomeName(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function setWelcomeName(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    // Greeting is cosmetic — never let storage failures break auth flows.
  }
}
