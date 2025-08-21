'use server';

interface CloudflareAIResponse {
  result?: any;
  response?: string;
  description?: string;
  success?: boolean;
  errors?: string[];
}

interface AnalysisResult {
  success: boolean;
  data?: {
    data: Record<string, any>;
    fields: string[];
    inputType: string;
    confidence: number;
    summary: string;
    wordCount: number;
  };
  error?: string;
}

// Cloudflare AI API configuration
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_AI_BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run`;

// Cloudflare AI API call function
async function callCloudflareAI(model: string, inputs: any): Promise<CloudflareAIResponse> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error('Cloudflare AI credentials not configured');
  }

  try {
    const response = await fetch(
      `${CLOUDFLARE_AI_BASE_URL}/${model}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inputs),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudflare AI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    //@ts-ignore
    return data;
  } catch (error) {
    console.error('Cloudflare AI API call failed:', error);
    throw new Error(`Failed to call Cloudflare AI: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Chunk large content for processing
function chunkText(text: string, maxChunkSize: number = 3000): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }
  
  const chunks: string[] = [];
  let startIndex = 0;
  
  while (startIndex < text.length) {
    let endIndex = Math.min(startIndex + maxChunkSize, text.length);
    
    // Try to break at sentence boundary
    if (endIndex < text.length) {
      const lastSentence = text.lastIndexOf('.', endIndex);
      const lastParagraph = text.lastIndexOf('\n\n', endIndex);
      const breakPoint = Math.max(lastSentence, lastParagraph);
      
      if (breakPoint > startIndex + maxChunkSize * 0.7) {
        endIndex = breakPoint + 1;
      }
    }
    
    chunks.push(text.substring(startIndex, endIndex).trim());
    startIndex = endIndex;
  }
  
  return chunks;
}

// Detect the type of content
function detectContentType(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('abstract') && lowerText.includes('introduction') && lowerText.includes('conclusion')) {
    return 'Academic Paper';
  }
  if (lowerText.includes('ingredients') && (lowerText.includes('recipe') || lowerText.includes('instructions'))) {
    return 'Recipe';
  }
  if (lowerText.includes('experience') && lowerText.includes('education') && lowerText.includes('skills')) {
    return 'Resume/CV';
  }
  if ((lowerText.includes('email') || lowerText.includes('@')) && lowerText.includes('password')) {
    return 'Credentials List';
  }
  if (lowerText.match(/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/)) {
    return 'Date-based Content';
  }
  if (lowerText.includes('meeting') && (lowerText.includes('agenda') || lowerText.includes('minutes'))) {
    return 'Meeting Notes';
  }
  if (text.split('\n').length > 10 && text.includes(',')) {
    return 'Structured Data';
  }
  if (lowerText.includes('story') || lowerText.includes('chapter') || text.split('.').length > 20) {
    return 'Narrative/Story';
  }
  if (lowerText.includes('product') && (lowerText.includes('price') || lowerText.includes('feature'))) {
    return 'Product Information';
  }
  
  return 'General Text';
}

// Generate summary using AI
async function generateSummary(text: string): Promise<string> {
  try {
    const truncatedText = text.substring(0, 2000);
    
    const response = await callCloudflareAI('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: "system",
          content: "You are a skilled summarizer. Create a concise, informative summary of the given text. Focus on the main points and key information."
        },
        {
          role: "user",
          content: `Please provide a brief summary (2-3 sentences) of the following text:\n\n${truncatedText}`
        }
      ],
      max_tokens: 200,
      temperature: 0.3
    });

    if (response.result?.response) {
      return response.result.response.trim();
    }
    
    return 'Summary generation failed';
  } catch (error) {
    console.error('Summary generation error:', error);
    return 'Unable to generate summary';
  }
}

// Main AI text analysis function
async function analyzeTextWithAI(text: string, contentType: string): Promise<Record<string, any>> {
  try {
    const chunks = chunkText(text, 3500);
    let combinedAnalysis: Record<string, any> = {};
    
    for (let i = 0; i < Math.min(chunks.length, 2); i++) {
      const chunk = chunks[i];
      
      const prompt = `Analyze and organize this ${contentType} content into a structured JSON format. Extract key information, entities, relationships, and organize data logically. Focus on making the content more readable and structured.

Rules:
1. Return only valid JSON without markdown formatting
2. Create meaningful categories and subcategories
3. Extract entities like names, dates, locations, etc.
4. Identify patterns and relationships
5. Organize information hierarchically
6. Include metadata where relevant

Content to analyze:
${chunk}`;

      const response = await callCloudflareAI('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: "system",
            content: "You are an expert data analyst and organizer. Transform unstructured text into well-organized, structured JSON data. Focus on clarity, usefulness, and logical organization."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.2
      });

      if (response.result?.response) {
        try {
          const cleanJson = response.result.response
            .replace(/```json\n?|\n?```/g, '')
            .replace(/```\n?|\n?```/g, '')
            .trim();

          const parsed = JSON.parse(cleanJson);

          if (typeof parsed === 'object' && parsed !== null) {
            if (i === 0) {
              combinedAnalysis = parsed;
            } else {
              // Smart merge of multiple chunks
              mergeAnalysisResults(combinedAnalysis, parsed);
            }
          }
        } catch (parseError) {
          console.log(`Chunk ${i} parsing failed, attempting to extract JSON`);
          
          const jsonMatch = response.result.response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              if (i === 0) combinedAnalysis = parsed;
            } catch (e) {
              console.error('Failed to parse extracted JSON:', e);
            }
          }
        }
      }
    }

    if (Object.keys(combinedAnalysis).length > 0) {
      return combinedAnalysis;
    }

    throw new Error('AI analysis failed');
    
  } catch (error) {
    console.error('AI analysis error:', error);
    return fallbackAnalysis(text, contentType);
  }
}

// Smart merge function for combining analysis results
function mergeAnalysisResults(target: Record<string, any>, source: Record<string, any>) {
  Object.keys(source).forEach(key => {
    if (Array.isArray(source[key]) && Array.isArray(target[key])) {
      // Merge arrays, avoiding duplicates
      const combined = [...target[key], ...source[key]];
      target[key] = combined.filter((item, index, arr) => 
        arr.findIndex(i => JSON.stringify(i) === JSON.stringify(item)) === index
      );
    } else if (typeof source[key] === 'object' && source[key] !== null && 
               typeof target[key] === 'object' && target[key] !== null) {
      // Recursively merge objects
      if (!target[key]) target[key] = {};
      mergeAnalysisResults(target[key], source[key]);
    } else if (!target[key]) {
      // Add new properties
      target[key] = source[key];
    }
  });
}

// Fallback analysis when AI fails
function fallbackAnalysis(text: string, contentType: string): Record<string, any> {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  // Extract basic entities
  const emails = text.match(/[\w.-]+@[\w.-]+\.\w+/g) || [];
  const urls = text.match(/https?:\/\/[\w.-]+\.[a-z]{2,}[\w\/.-]*/gi) || [];
  const dates = text.match(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/g) || [];
  const numbers = text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
  
  // Word frequency analysis
  const wordFreq: Record<string, number> = {};
  words.forEach(word => {
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
    if (cleanWord.length > 3) {
      wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1;
    }
  });
  
  const topWords = Object.entries(wordFreq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  return {
    document_type: contentType,
    content_analysis: {
      word_count: words.length,
      sentence_count: sentences.length,
      paragraph_count: paragraphs.length,
      average_sentence_length: Math.round(words.length / sentences.length),
      reading_time_minutes: Math.ceil(words.length / 200)
    },
    extracted_entities: {
      emails: emails,
      urls: urls,
      dates: dates,
      numbers: numbers.slice(0, 10) // Limit to avoid clutter
    },
    key_terms: topWords,
    structure: {
      paragraphs: paragraphs.map((para, index) => ({
        index: index + 1,
        word_count: para.split(/\s+/).length,
        preview: para.substring(0, 100) + (para.length > 100 ? '...' : '')
      }))
    },
    metadata: {
      analysis_method: 'fallback_rule_based',
      processing_timestamp: new Date().toISOString(),
      content_type_detected: contentType
    }
  };
}

// Calculate confidence score
function calculateConfidence(data: Record<string, any>, originalText: string): number {
  let confidence = 0.5; // Base confidence
  
  const fieldCount = Object.keys(data).length;
  if (fieldCount > 5) confidence += 0.1;
  if (fieldCount > 10) confidence += 0.1;
  
  // Check for structured data
  const hasArrays = Object.values(data).some(v => Array.isArray(v));
  const hasObjects = Object.values(data).some(v => 
    typeof v === 'object' && v !== null && !Array.isArray(v)
  );
  
  if (hasArrays) confidence += 0.1;
  if (hasObjects) confidence += 0.1;
  
  // Check for meaningful extraction
  const textLength = originalText.length;
  const extractionRatio = JSON.stringify(data).length / textLength;
  
  if (extractionRatio > 0.1) confidence += 0.1; // Good extraction ratio
  if (extractionRatio > 0.3) confidence += 0.1; // Excellent extraction ratio
  
  // Check for AI processing indicators
  if (!data.metadata?.analysis_method?.includes('fallback')) {
    confidence += 0.2; // AI processing succeeded
  }
  
  return Math.min(0.95, Math.max(0.3, confidence));
}

// Main export function
export async function analyzeText(inputText: string): Promise<AnalysisResult> {
  try {
    if (!inputText.trim()) {
      return { success: false, error: 'No text provided for analysis' };
    }

    const wordCount = inputText.split(/\s+/).filter(w => w.length > 0).length;
    
    if (wordCount < 5) {
      return { success: false, error: 'Text is too short for meaningful analysis' };
    }

    if (inputText.length > 50000) {
      return { 
        success: false, 
        error: 'Text is too long. Please limit to 50,000 characters or less.' 
      };
    }

    // Detect content type
    const contentType = detectContentType(inputText);
    
    try {
      // Generate summary
      const summary = await generateSummary(inputText);
      
      // Perform AI analysis
      const structuredData = await analyzeTextWithAI(inputText, contentType);
      
      // Calculate confidence
      const confidence = calculateConfidence(structuredData, inputText);
      
      // Extract fields
      const fields = extractFields(structuredData);

      return {
        success: true,
        data: {
          data: structuredData,
          fields,
          inputType: contentType,
          confidence,
          summary,
          wordCount
        }
      };

    } catch (analysisError) {
      console.error('Analysis error:', analysisError);
      return {
        success: false,
        error: `Analysis failed: ${analysisError instanceof Error ? analysisError.message : 'Unknown error'}`
      };
    }

  } catch (error) {
    console.error('Text analysis error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred during text analysis'
    };
  }
}

// Extract field names from structured data
function extractFields(data: Record<string, any>, prefix = ''): string[] {
  const fields: string[] = [];
  
  Object.keys(data).forEach(key => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    fields.push(fullKey);
    
    if (typeof data[key] === 'object' && data[key] !== null && !Array.isArray(data[key])) {
      // Recursively extract nested fields (limit depth to avoid infinite recursion)
      if (prefix.split('.').length < 3) {
        fields.push(...extractFields(data[key], fullKey));
      }
    }
  });
  
  return fields;
}