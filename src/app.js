// server.js

import express from 'express';
import crypto from 'crypto';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import sequelize from './config/database.js';
import defineStringModel from './models/String.js';
import { Op, Sequelize } from 'sequelize'; // FIX: Import Op & Sequelize properly

dotenv.config();

const app = express();
app.use(bodyParser.json());

// Initialize Sequelize Model
const StringModel = defineStringModel(sequelize);

// Test DB Connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to PostgreSQL database');
    await sequelize.sync({ alter: true });
    console.log('Database tables synchronized');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

// --- Utility Function for String Analysis ---
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

// --- Create / Analyze String ---
app.post('/strings', async (req, res) => {
  try {
    const { value } = req.body;

    if (!value || typeof value !== 'string') {
      return res.status(422).json({ error: 'Invalid data type for "value", must be string' });
    }

    const properties = analyzeString(value);

    const existing = await StringModel.findOne({
      where: { id: properties.sha256_hash }
    });

    if (existing) {
      return res.status(409).json({ error: 'String already exists in the system' });
    }

    const newString = await StringModel.create({
      id: properties.sha256_hash,
      value,
      properties,
    });

    res.status(201).json({
      id: newString.id,
      value: newString.value,
      properties: newString.properties,
      created_at: newString.created_at,
    });
  } catch (err) {
    console.error('POST /strings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Get Specific String ---
app.get('/strings/:string_value', async (req, res) => {
  try {
    const stringValue = req.params.string_value;
    const sha256Hash = crypto.createHash('sha256').update(stringValue).digest('hex');

    const stringData = await StringModel.findByPk(sha256Hash);

    if (!stringData) {
      return res.status(404).json({ error: 'String does not exist in the system' });
    }

    res.status(200).json({
      id: stringData.id,
      value: stringData.value,
      properties: stringData.properties,
      created_at: stringData.created_at,
    });
  } catch (err) {
    console.error('GET /strings/:string_value error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Get All Strings with Filtering ---
app.get('/strings', async (req, res) => {
  try {
    const { is_palindrome, min_length, max_length, word_count, contains_character } = req.query;
    const filtersApplied = [];
    const whereClause = [];

    // JSONB property filters
    if (is_palindrome) {
      if (!['true', 'false'].includes(is_palindrome))
        return res.status(400).json({ error: 'Invalid query parameter value for is_palindrome' });

      whereClause.push(Sequelize.where(Sequelize.json('properties.is_palindrome'), is_palindrome === 'true'));
      filtersApplied.push({ is_palindrome });
    }

    if (min_length) {
      if (isNaN(min_length) || min_length < 0)
        return res.status(400).json({ error: 'Invalid query parameter value for min_length' });

      whereClause.push(Sequelize.where(Sequelize.json('properties.length'), { [Op.gte]: Number(min_length) }));
      filtersApplied.push({ min_length });
    }

    if (max_length) {
      if (isNaN(max_length) || max_length < 0)
        return res.status(400).json({ error: 'Invalid query parameter value for max_length' });

      whereClause.push(Sequelize.where(Sequelize.json('properties.length'), { [Op.lte]: Number(max_length) }));
      filtersApplied.push({ max_length });
    }

    if (word_count) {
      if (isNaN(word_count) || word_count < 0)
        return res.status(400).json({ error: 'Invalid query parameter value for word_count' });

      whereClause.push(Sequelize.where(Sequelize.json('properties.word_count'), Number(word_count)));
      filtersApplied.push({ word_count });
    }

    if (contains_character) {
      if (contains_character.length !== 1)
        return res.status(400).json({ error: 'Invalid query parameter for contains_character' });

      whereClause.push({ value: { [Op.iLike]: `%${contains_character}%` } });
      filtersApplied.push({ contains_character });
    }

    const { count, rows } = await StringModel.findAndCountAll({
      where: { [Op.and]: whereClause },
      limit: 100,
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({
      data: rows,
      count,
      filters_applied: filtersApplied
    });
  } catch (err) {
    console.error('GET /strings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Natural Language Filtering ---
app.get('/strings/filter-by-natural-language', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== 'string')
      return res.status(400).json({ error: 'Unable to parse natural language query' });

    const parsedFilters = {};
    let whereClause = {};

    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('single word') && lowerQuery.includes('palindromic')) {
      parsedFilters.word_count = 1;
      parsedFilters.is_palindrome = true;
      whereClause = {
        [Op.and]: [
          Sequelize.where(Sequelize.json('properties.word_count'), 1),
          Sequelize.where(Sequelize.json('properties.is_palindrome'), true)
        ]
      };
    } else if (lowerQuery.includes('longer than') && lowerQuery.match(/longer than (\d+)/)) {
      const minLength = parseInt(lowerQuery.match(/longer than (\d+)/)[1]) + 1;
      parsedFilters.min_length = minLength;
      whereClause = {
        [Op.and]: [
          Sequelize.where(Sequelize.json('properties.length'), { [Op.gte]: minLength })
        ]
      };
    } else if (lowerQuery.includes('palindromic') && lowerQuery.includes('first vowel')) {
      parsedFilters.is_palindrome = true;
      parsedFilters.contains_character = 'a';
      whereClause = {
        [Op.and]: [
          Sequelize.where(Sequelize.json('properties.is_palindrome'), true),
          { value: { [Op.iLike]: '%a%' } }
        ]
      };
    } else if (lowerQuery.includes('containing the letter') && lowerQuery.match(/letter (\w)/)) {
      const char = lowerQuery.match(/letter (\w)/)[1];
      parsedFilters.contains_character = char;
      whereClause = { value: { [Op.iLike]: `%${char}%` } };
    } else {
      return res.status(400).json({ error: 'Unable to parse natural language query' });
    }

    const { count, rows } = await StringModel.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({
      data: rows,
      count,
      interpreted_query: {
        original: query,
        parsed_filters: parsedFilters,
      },
    });
  } catch (err) {
    console.error('GET /strings/filter-by-natural-language error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Delete String ---
app.delete('/strings/:string_value', async (req, res) => {
  try {
    const stringValue = req.params.string_value;
    const sha256Hash = crypto.createHash('sha256').update(stringValue).digest('hex');

    const deleted = await StringModel.destroy({ where: { id: sha256Hash } });

    if (deleted === 0)
      return res.status(404).json({ error: 'String does not exist in the system' });

    res.status(204).send();
  } catch (err) {
    console.error('DELETE /strings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Health Check ---
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({
      status: 'OK',
      database: 'PostgreSQL with Sequelize',
      connection: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'local'
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', database: 'PostgreSQL connection failed' });
  }
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Connected to PostgreSQL via: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'local'}`);
  });
};

startServer();

export default app;
