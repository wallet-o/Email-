const express = require('express');
const axios = require('axios');
const emailValidator = require('deep-email-validator');
const sqlite3 = require('sqlite3').verbose();
const app = express();

// SQLite setup
const db = new sqlite3.Database('emails.db');
db.run('CREATE TABLE IF NOT EXISTS emails (email TEXT, source TEXT, date TEXT)');

// Google API config with your provided values
const API_KEY = 'AIzaSyAxno8MaYZAJsNEIhjhYoeWC3zbbyp8UP0';
const CX = '3578ab1749f7b4b9c';
const SEARCH_URL = 'https://www.googleapis.com/customsearch/v1';

// Function to extract emails from text
function extractEmails(text) {
  const emailPattern = /[\w\.-]+@[\w\.-]+\.\w+/g;
  return text.match(emailPattern) || [];
}

// Main route to fetch emails
app.get('/fetch-emails', async (req, res) => {
  try {
    // Search Google with your API key and CX
    const response = await axios.get(SEARCH_URL, {
      params: { key: API_KEY, cx: CX, q: 'contact us site:*.com -inurl:(login)' }
    });

    const items = response.data.items || [];
    let allEmails = [];

    // Process each search result
    for (const item of items) {
      const pageResponse = await axios.get(item.link);
      const emails = extractEmails(pageResponse.data);
      
      // Validate and store unique emails
      for (const email of emails) {
        const validation = await emailValidator.validate(email);
        if (validation.valid) {
          db.run('INSERT INTO emails (email, source, date) VALUES (?, ?, ?)', 
            [email, item.link, new Date().toISOString()]);
          allEmails.push(email);
        }
      }
    }

    res.json({ emails: allEmails });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching emails');
  }
});

// Serve HTML frontend
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// API to get stored emails
app.get('/emails', (req, res) => {
  db.all('SELECT email FROM emails', (err, rows) => {
    if (err) return res.status(500).send('DB error');
    res.json(rows.map(row => row.email));
  });
});

app.listen(3000, () => console.log('Server running on port 3000'));
