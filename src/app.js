import express from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(bodyParser.json());

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env file');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Utility functions for string analysis (UNCHANGED)
const analyzeString = (str) => {
  const length = str.length;
  const isPalindrome = str.toLowerCase() === str.toLowerCase().split('').reverse().join('');
  const uniqueCharacters = new Set(str).size;
  const wordCount = str.trim().split(/\s+/).length;
  const sha256Hash = crypto.createHash('sha256').update(str).digest('hex');
  const characterFrequencyMap = {};
  for (const char of str) {
    characterFrequencyMap[char] = (characterFrequencyMap[char] || 0) + 1;
  }

  return {
    length,
    is_palindrome: isPalindrome,
    unique_characters: uniqueCharacters,
    word_count: wordCount,
    sha256_hash: sha256Hash,
    character_frequency_map: characterFrequencyMap,
  };
};

// Create/Analyze String - POST /strings
app.post('/strings', async (req, res) => {
  try {
    const { value } = req.body;
    if (!value || typeof value !== 'string') {
      return res.status(422).json({ error: 'Invalid data type for "value", must be string' });
    }
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'Invalid request body or missing "value" field' });
    }

    const properties = analyzeString(value);
    const createdAt = new Date().toISOString();

    // Check if string already exists (using Supabase)
    const { data: existing, error: checkError } = await supabase
      .from('strings')
      .select('*')
      .eq('sha256_hash', properties.sha256_hash)
      .single();

    if (checkError && checkError.code !== 'PGRST116') throw checkError; // PGRST116 = no rows
    if (existing) {
      return res.status(409).json({ error: 'String already exists in the system' });
    }

    // Insert new string
    const { data, error } = await supabase
      .from('strings')
      .insert([{
        id: properties.sha256_hash,
        value,
        properties,
        created_at: createdAt
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      id: data.sha256_hash,
      value: data.value,
      properties: data.properties,
      created_at: data.created_at,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Specific String - GET /strings/:string_value
app.get('/strings/:string_value', async (req, res) => {
  try {
    const stringValue = req.params.string_value;
    const sha256Hash = crypto.createHash('sha256').update(stringValue).digest('hex');

    const { data, error } = await supabase
      .from('strings')
      .select('*')
      .eq('sha256_hash', sha256Hash)
      .single();

    if (error && error.code === 'PGRST116') {
      return res.status(404).json({ error: 'String does not exist in the system' });
    }
    if (error) throw error;

    res.status(200).json({
      id: data.sha256_hash,
      value: data.value,
      properties: data.properties,
      created_at: data.created_at,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get All Strings with Filtering - GET /strings
app.get('/strings', async (req, res) => {
  try {
    const { is_palindrome, min_length, max_length, word_count, contains_character } = req.query;
    let query = supabase.from('strings').select('*');
    const filtersApplied = {};

    if (is_palindrome) {
      if (!['true', 'false'].includes(is_palindrome)) {
        return res.status(400).json({ error: 'Invalid query parameter value for is_palindrome' });
      }
      query = query.eq('properties->is_palindrome', is_palindrome === 'true');
      filtersApplied.is_palindrome = is_palindrome === 'true';
    }
    if (min_length) {
      if (isNaN(min_length) || min_length < 0) {
        return res.status(400).json({ error: 'Invalid query parameter value for min_length' });
      }
      query = query.gte('properties->length', Number(min_length));
      filtersApplied.min_length = Number(min_length);
    }
    if (max_length) {
      if (isNaN(max_length) || max_length < 0) {
        return res.status(400).json({ error: 'Invalid query parameter value for max_length' });
      }
      query = query.lte('properties->length', Number(max_length));
      filtersApplied.max_length = Number(max_length);
    }
    if (word_count) {
      if (isNaN(word_count) || word_count < 0) {
        return res.status(400).json({ error: 'Invalid query parameter value for word_count' });
      }
      query = query.eq('properties->word_count', Number(word_count));
      filtersApplied.word_count = Number(word_count);
    }
    if (contains_character) {
      if (contains_character.length !== 1) {
        return res.status(400).json({ error: 'Invalid query parameter value for contains_character' });
      }
      query = query.ilike('value', `%${contains_character}%`);
      filtersApplied.contains_character = contains_character;
    }

    const { data, error, count } = await query;

    if (error) throw error;

    res.status(200).json({
      data,
      count: count || data.length,
      filters_applied: filtersApplied,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Natural Language Filtering - GET /strings/filter-by-natural-language
app.get('/strings/filter-by-natural-language', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Unable to parse natural language query' });
    }

    const parsedFilters = {};
    let supabaseQuery = supabase.from('strings').select('*', { count: 'exact' });

    // Basic natural language parsing logic (SAME LOGIC, SUPABASE SYNTAX)
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('single word') && lowerQuery.includes('palindromic')) {
      parsedFilters.word_count = 1;
      parsedFilters.is_palindrome = true;
      supabaseQuery = supabaseQuery
        .eq('properties->word_count', 1)
        .eq('properties->is_palindrome', true);
    } else if (lowerQuery.includes('longer than') && lowerQuery.match(/longer than (\d+)/)) {
      const minLength = parseInt(lowerQuery.match(/longer than (\d+)/)[1]) + 1;
      parsedFilters.min_length = minLength;
      supabaseQuery = supabaseQuery.gte('properties->length', minLength);
    } else if (lowerQuery.includes('palindromic') && lowerQuery.includes('first vowel')) {
      parsedFilters.is_palindrome = true;
      parsedFilters.contains_character = 'a';
      supabaseQuery = supabaseQuery
        .eq('properties->is_palindrome', true)
        .ilike('value', '%a%');
    } else if (lowerQuery.includes('containing the letter') && lowerQuery.match(/letter (\w)/)) {
      const char = lowerQuery.match(/letter (\w)/)[1];
      parsedFilters.contains_character = char;
      supabaseQuery = supabaseQuery.ilike('value', `%${char}%`);
    } else {
      return res.status(400).json({ error: 'Unable to parse natural language query' });
    }

    const { data, error, count } = await supabaseQuery;

    if (error) throw error;

    res.status(200).json({
      data,
      count: count || data.length,
      interpreted_query: {
        original: query,
        parsed_filters: parsedFilters,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete String - DELETE /strings/:string_value
app.delete('/strings/:string_value', async (req, res) => {
  try {
    const stringValue = req.params.string_value;
    const sha256Hash = crypto.createHash('sha256').update(stringValue).digest('hex');

    const { error } = await supabase
      .from('strings')
      .delete()
      .eq('sha256_hash', sha256Hash);

    if (error && error.code === 'PGRST116') {
      return res.status(404).json({ error: 'String does not exist in the system' });
    }
    if (error) throw error;

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', database: 'Supabase' });
});

// Start server (NO DATABASE INIT NEEDED - Supabase handles schema)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Connected to Supabase: ${supabaseUrl.replace(/\/.*$/, '')}`);
});

export default app;