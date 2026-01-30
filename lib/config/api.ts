export const AI_PROVIDER = 'deepseek' as const;

export const DEEPSEEK_CONFIG = {
  // 1. Tumia getter badala ya property ya kawaida
  // Hii inahakikisha kila tunapoita 'apiKey', tunasoma thamani mpya toka kwenye env
  get apiKey() {
    return process.env.DEEPSEEK_AI_API_KEY;
  },
  
  baseURL: 'https://api.deepseek.com',
  model: 'deepseek-chat',

  isConfigured() {
    // Tunatumia 'this.apiKey' hapa ili kurejea kwenye getter yetu
    return Boolean(this.apiKey && this.apiKey.startsWith('sk-'));
  },

  getKeyOrThrow() {
    const key = this.apiKey;
    if (!key) {
      throw new Error(
        'CRITICAL ERROR: DEEPSEEK_AI_API_KEY is missing. ' +
        'Check your .env.local file and restart the server with "npm run dev".'
      );
    }
    return key;
  }
};

// 2. Dead-end kwa Gemini (Good job mkuu, hapa ndipo tunamzika rasmi)
export const GEMINI_CONFIG = {
  isConfigured: () => false,
  apiKey: null as null
};