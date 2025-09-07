import { GoogleGenAI, Type } from "@google/genai";
import { ReviewResult } from '../types';

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "A concise, high-level summary of the code's purpose and overall quality in 2-3 sentences.",
    },
    suggestions: {
      type: Type.ARRAY,
      description: "A list of specific, actionable suggestions for improvement.",
      items: {
        type: Type.OBJECT,
        properties: {
          lineNumber: {
            type: Type.INTEGER,
            description: "The relevant line number for the suggestion. Use 0 if it applies to the whole file.",
          },
          category: {
            type: Type.STRING,
            description: "Categorize the suggestion (e.g., Logic, Security, Performance, Style, Readability, Best Practice).",
          },
          description: {
            type: Type.STRING,
            description: "A clear and detailed explanation of the issue or area for improvement.",
          },
          suggestion: {
            type: Type.STRING,
            description: "A concrete suggestion for a fix, including a code snippet if applicable. If no code change is needed, explain the recommended action.",
          },
        },
        required: ["lineNumber", "category", "description", "suggestion"],
      },
    },
  },
  required: ["summary", "suggestions"],
};


export const reviewCode = async (fileName: string, code: string, apiKey: string): Promise<ReviewResult> => {
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please provide it before running an analysis.");
  }
  
  const ai = new GoogleGenAI({ apiKey: apiKey });
  const model = "gemini-2.5-flash";

  const prompt = `
    You are an expert senior software engineer performing a code review. Your feedback must be constructive, professional, and highly precise.

    Analyze the following code from the file: \`${fileName}\`

    Your task is to:
    1.  Provide a concise, high-level summary of the code's purpose and quality.
    2.  Identify potential issues and areas for improvement.
    3.  Provide specific, actionable suggestions. For each suggestion, specify the line number, a clear category (e.g., Logic, Security, Performance, Style, Readability, Best Practice), a detailed description of the issue, and a concrete suggestion for how to fix it.
    4.  If the code is of high quality and has no issues, return an empty array for suggestions and state that in the summary.
    5.  Adhere strictly to the JSON schema provided for the response.

    Here is the code:
    ---
    ${code}
    ---
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });
    
    const jsonText = response.text.trim();
    const parsedResult = JSON.parse(jsonText) as ReviewResult;
    return parsedResult;

  } catch (error) {
    console.error("Gemini API Error:", error);
    if (error instanceof Error && (error.message.includes('API key not valid') || error.message.includes('API_KEY_INVALID'))) {
        throw new Error("Invalid Gemini API Key. Please check your key and try again.");
    }
    throw new Error("Failed to get code review from Gemini. Please check the console for more details.");
  }
};