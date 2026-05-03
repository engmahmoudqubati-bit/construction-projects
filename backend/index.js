require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();

const corsOptions = {
  origin: [
    'https://engmahmoudqubati-bit.github.io',
    'http://localhost:5173',
    'http://localhost:4173',
  ],
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));  // ← only once, with options
app.use(express.json());

// ... rest of your routes