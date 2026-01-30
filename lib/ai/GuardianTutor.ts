import OpenAI from 'openai';
import { getSubjectById, isAppropriateForGrade, type LearningArea } from '@/lib/cbcCurriculum';
import { DEEPSEEK_CONFIG } from '@/lib/config/api';

// Singleton instance ili kuzuia kutengeneza client nyingi zisizo na lazima
let aiClient: OpenAI | null = null;

function getAIClient(): OpenAI {
  if (aiClient) return aiClient;
  
  const apiKey = DEEPSEEK_CONFIG.getKeyOrThrow();
  console.log('🚀 DeepSeek Engine: Ignited & Ready for CBC');
  
  aiClient = new OpenAI({
    apiKey: apiKey,
    baseURL: DEEPSEEK_CONFIG.baseURL || 'https://api.deepseek.com'
  });
  
  return aiClient;
}

export class GuardianTutor {
  /**
   * Inazalisha majibu ya mwalimu kulingana na mtaala wa CBC
   */
  static async generateResponse(input: {
    subjectId: string;
    studentLevel?: number;
    studentGrade: number;
    question: string;
    conversationHistory?: any[];
  }): Promise<string> {
    const { subjectId, studentLevel, studentGrade, question, conversationHistory } = input;

    // 1. Uhakiki wa somo (Fallback kwenda mathematics kama somo halipo)
    const subject = getSubjectById(subjectId) || getSubjectById('mathematics');
    if (!subject) throw new Error("Critical Error: Curriculum data for this learning area is missing.");

    // 2. Kuchuja mada kulingana na Grade ya mwanafunzi
    const appropriateness = isAppropriateForGrade(studentGrade, question);
    if (!appropriateness.appropriate) {
      return `📚 Samahani mwanangu, mada hii haimo kwenye mtaala wa CBC wa Grade ${studentGrade}. ${appropriateness.reason || 'Tafadhali uliza kitu kingine.'}`;
    }

    const systemPrompt = this.buildCBCStrictPrompt(subject, studentLevel || 2, studentGrade);
    const client = getAIClient();

    // 3. Kuandaa messages kwa mfumo ambao OpenAI TypeScript inaukubali (Strict Typing)
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { 
        role: 'system', 
        content: systemPrompt 
      },
      ...(conversationHistory?.slice(-5).map((m: any) => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: String(m.content)
      })) || []),
      { 
        role: 'user', 
        content: question 
      }
    ];

    try {
      const response = await client.chat.completions.create({
        model: DEEPSEEK_CONFIG.model || "deepseek-chat",
        messages: messages,
        temperature: 0.6,
        max_tokens: 1000,
      });

      return response.choices[0]?.message?.content || "Samahani, mwalimu amekosa jibu kwa sasa. Hebu jaribu tena.";
    } catch (error: any) {
      console.error('🔴 DeepSeek API Error:', error.message);
      
      // Error handling ya kiungwana kwa mtumiaji wa App
      if (error.message.includes('401')) {
        throw new Error("Tatizo la kiufundi (Authentication). Wasiliana na msimamizi.");
      }
      throw new Error(`Mwalimu amepata hitilafu kidogo: ${error.message}`);
    }
  }

  /**
   * Inatengeneza 'Personality' ya mwalimu wa CBC
   */
  private static buildCBCStrictPrompt(subject: LearningArea, level: number, grade: number): string {
    return `
      You are 'Guardian Tutor', a professional Kenyan teacher specialized in the Competency-Based Curriculum (CBC).
      
      CURRENT CONTEXT:
      - Learning Area: ${subject.name}
      - Student Grade: Grade ${grade}
      - Student Proficiency Level: ${level}/5
      
      GUIDELINES:
      1. TERMINOLOGY: Use CBC terms only (e.g., 'Learning Outcomes', 'Strands', 'Sub-strands').
      2. TONE: Encouraging, patient, and pedagogical. Use age-appropriate language for a Grade ${grade} student.
      3. CONTEXT: Use Kenyan examples (e.g., local currency in KES, local towns, Kenyan names like Muli, Achieng, or Fatima).
      4. CORE COMPETENCIES: Structure your answers to encourage Critical Thinking and Problem Solving.
      5. LANGUAGE: Respond in English primarily, but you can use simple Swahili phrases for encouragement (e.g., 'Kazi nzuri!', 'Jaribu tena').
      6. FORMAT: Use bullet points for steps to make it easy for a child to read.
    `.trim();
  }
}