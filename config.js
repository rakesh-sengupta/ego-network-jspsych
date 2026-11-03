/* ==========================================================================
   STUDY SETTINGS: edit this file, not experiment.js
   Ego-network name generator (GSS "important matters"; Burt, 1984)
   ========================================================================== */
const CONFIG = {
  STUDY_TITLE: "Emotional Use of AI Chatbots and Human Social Trust",
  TASK_VERSION: "1.0.0",

  /* ---- Name generator ----------------------------------------------------
     Keep the wording fixed once it is pre-registered: network size and
     density are properties of the question asked. */
  N_SLOTS: 6,
  NAME_GENERATOR_TEXT:
    "From time to time, most people discuss important matters with other people. " +
    "Looking back over the last six months, who are the people with whom you discussed matters important to you?",

  /* ---- Name interpreters: answer options --------------------------------
     `value` is what is saved; `label` is what the participant sees.
     Values are stable codes so the analysis script never depends on wording. */
  RELATIONSHIP_OPTIONS: [
    { value: "partner", label: "Romantic partner", kin: false },
    { value: "parent", label: "Parent or guardian", kin: true },
    { value: "sibling", label: "Brother or sister", kin: true },
    { value: "other_family", label: "Other family member", kin: true },
    { value: "friend", label: "Friend", kin: false },
    { value: "roommate", label: "Roommate or hostel-mate", kin: false },
    { value: "classmate", label: "Classmate or fellow student", kin: false },
    { value: "teacher", label: "Teacher, professor or mentor", kin: false },
    { value: "coworker", label: "Colleague or co-worker", kin: false },
    { value: "online_only", label: "Someone I know only online", kin: false },
    { value: "ai", label: "An AI chatbot or assistant", kin: false },
    { value: "other", label: "Someone else", kin: false, text: true, placeholder: "please describe" },
  ],
  CONTACT_OPTIONS: [
    // value = higher means more frequent (used as a tie-strength component)
    { value: 5, label: "Every day or almost every day" },
    { value: 4, label: "A few times a week" },
    { value: 3, label: "About once a week" },
    { value: 2, label: "A few times a month" },
    { value: 1, label: "Once a month or less" },
  ],
  CLOSENESS_OPTIONS: [
    { value: 1, label: "Not at all close" },
    { value: 2, label: "Slightly close" },
    { value: 3, label: "Moderately close" },
    { value: 4, label: "Very close" },
    { value: 5, label: "Extremely close" },
  ],
  LANGUAGE_OPTIONS: [
    { value: "english", label: "English" },
    { value: "malayalam", label: "Malayalam" },
    { value: "tamil", label: "Tamil" },
    { value: "telugu", label: "Telugu" },
    { value: "kannada", label: "Kannada" },
    { value: "hindi", label: "Hindi" },
    { value: "bengali", label: "Bengali" },
    { value: "mixed", label: "A mix of languages, with no main one" },
    { value: "other", label: "Another language", text: true, placeholder: "which one?" },
  ],
  TIE_OPTIONS: [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
    { value: "unsure", label: "Not sure" },
  ],

  /* ---- AI block -----------------------------------------------------------
     Places the AI chatbot on the same scales as the people (deck slides 25–27). */
  AI_EXAMPLES: "such as ChatGPT, Gemini, Claude, Meta AI, Character.AI or similar",
  AI_FREQUENCY_OPTIONS: [
    { value: 0, label: "Never" },
    { value: 1, label: "Once a month or less" },
    { value: 2, label: "A few times a month" },
    { value: 3, label: "About once a week" },
    { value: 4, label: "A few times a week" },
    { value: 5, label: "Every day or almost every day" },
  ],

  /* Names typed in the generator that look like an AI product are flagged
     (flag only; the name itself is never saved). Lower-case, whole words. */
  AI_NAME_KEYWORDS: [
    "ai", "chatgpt", "gpt", "openai", "claude", "gemini", "bard", "copilot", "bing",
    "meta ai", "llama", "perplexity", "replika", "character.ai", "character ai",
    "pi", "grok", "deepseek", "chatbot", "bot", "siri", "alexa",
  ],

  /* ---- Data ---------------------------------------------------------------
     One JSON file per participant is downloaded at the end. Names are replaced
     by codes (A1…A6) before the file is built, and are never written to disk. */
  FILE_PREFIX: "egonet",
  ALTER_CODE_PREFIX: "A",
  PARTICIPANT_ID_PATTERN: /^[A-Za-z0-9_-]{2,20}$/,
};
