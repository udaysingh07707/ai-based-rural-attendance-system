export const SETTINGS_PREFERENCES_KEY = "rural-attendance-settings";
export const SETTINGS_PREFERENCES_EVENT = "rural-attendance-settings-change";

export const DEFAULT_SETTINGS_PREFERENCES = {
  language: "en-IN",
  voiceAssistantEnabled: true,
  emailNotifications: false,
  attendanceReminders: false,
};

export function readSettingsPreferences() {
  if (typeof window === "undefined") return DEFAULT_SETTINGS_PREFERENCES;

  try {
    const stored = JSON.parse(window.localStorage.getItem(SETTINGS_PREFERENCES_KEY) || "{}");
    return {
      ...DEFAULT_SETTINGS_PREFERENCES,
      ...stored,
      language: stored.language === "hi-IN" ? "hi-IN" : "en-IN",
      voiceAssistantEnabled: stored.voiceAssistantEnabled !== false,
      emailNotifications: stored.emailNotifications === true,
      attendanceReminders: stored.attendanceReminders === true,
    };
  } catch {
    return DEFAULT_SETTINGS_PREFERENCES;
  }
}

export function writeSettingsPreferences(preferences) {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.setItem(SETTINGS_PREFERENCES_KEY, JSON.stringify(preferences));
    window.dispatchEvent(new Event(SETTINGS_PREFERENCES_EVENT));
    return true;
  } catch {
    return false;
  }
}
