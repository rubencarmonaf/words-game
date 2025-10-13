import axios from 'axios';
import { DictionaryService } from '../types';

// No local dictionary - using external APIs only

export class SpanishDictionaryService implements DictionaryService {
  private cache = new Map<string, boolean>();

  async validateWord(word: string): Promise<boolean> {
    const normalizedWord = word.toLowerCase().trim();
    
    // Check cache first
    if (this.cache.has(normalizedWord)) {
      return this.cache.get(normalizedWord)!;
    }

    try {
      console.log(`Validating word "${normalizedWord}" with RAE API...`);
      // Try RAE API (primary method)
      const isValid = await this.validateWithRAEAPI(normalizedWord);
      console.log(`RAE API result for "${normalizedWord}":`, isValid);
      this.cache.set(normalizedWord, isValid);
      return isValid;
    } catch (error) {
      console.warn(`RAE API failed for word "${normalizedWord}":`, error);
      
      // If API fails, return false (no fallback)
      console.log(`No validation available for "${normalizedWord}"`);
      this.cache.set(normalizedWord, false);
      return false;
    }
  }

  private async validateWithRAEAPI(word: string): Promise<boolean> {
    try {
      const url = `https://rae-api.com/api/words/${encodeURIComponent(word)}`;
      console.log(`Making RAE API request to: ${url}`);
      
      // Use RAE API
      const response = await axios.get(url, {
        timeout: 8000,
        headers: {
          'User-Agent': 'WordWars/1.0',
          'Accept': 'application/json'
        }
      });
      
      console.log(`RAE API response status: ${response.status}`);
      console.log(`RAE API response data:`, response.data);
      
      // Check if the response contains valid word data
      if (response.status === 200 && response.data) {
        const data = response.data;
        
        // RAE API returns { ok: boolean, data: WordEntry } for success
        // or { ok: false, error: "NOT_FOUND" } for not found
        if (data.ok === true && data.data) {
          console.log(`Word "${word}" found in RAE:`, data.data.word);
          return true;
        } else if (data.ok === false && data.error === "NOT_FOUND") {
          console.log(`Word "${word}" not found in RAE`);
          return false;
        }
      }
      
      return false;
    } catch (error) {
      // If it's a 404, the word doesn't exist
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          console.log(`Word "${word}" not found (404)`);
          return false;
        }
      }
      
      // For other errors (network, timeout, etc.), throw to use fallback
      throw error;
    }
  }

  // Add word to cache (for testing or manual additions)
  addWord(word: string): void {
    this.cache.set(word.toLowerCase(), true);
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
    console.log('Dictionary cache cleared');
  }

  // Clear cache for new game
  clearCacheForNewGame(): void {
    this.cache.clear();
    console.log('Dictionary cache cleared for new game');
  }

  // Get cache stats
  getCacheStats(): { size: number; words: string[] } {
    return {
      size: this.cache.size,
      words: Array.from(this.cache.keys())
    };
  }

  // Test RAE API connectivity
  async testRAEAPIConnectivity(): Promise<boolean> {
    try {
      const response = await axios.get('https://rae-api.com/api/words/hablar', {
        timeout: 5000,
        headers: {
          'User-Agent': 'WordWars/1.0',
          'Accept': 'application/json'
        }
      });
      
      console.log('RAE API connectivity test response:', response.data);
      return response.status === 200 && response.data?.ok === true;
    } catch (error) {
      console.warn('RAE API connectivity test failed:', error);
      return false;
    }
  }

  // Get full word information (for future use)
  async getWordInfo(word: string): Promise<any> {
    try {
      const url = `https://rae-api.com/api/words/${encodeURIComponent(word)}`;
      const response = await axios.get(url, {
        timeout: 8000,
        headers: {
          'User-Agent': 'WordWars/1.0',
          'Accept': 'application/json'
        }
      });
      
      if (response.status === 200 && response.data?.ok === true) {
        return response.data.data;
      }
      
      return null;
    } catch (error) {
      console.warn(`Error getting word info for "${word}":`, error);
      return null;
    }
  }

  // Get validation method being used
  getValidationMethod(): 'RAE_API' | 'CACHED' {
    // This is a simple way to indicate which method is being used
    return 'RAE_API'; // Primary method
  }
}

// Export singleton instance
export const dictionaryService = new SpanishDictionaryService();
