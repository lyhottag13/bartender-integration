import pool from './src/db.js';
import port from './src/port.js';

// START BOILERPLATE.

import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dependencies for the app to read user input and to return JSONs.
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.listen(port, '0.0.0.0', () => {
    console.log(`App running on port ${port}`);
});

// END BOILERPLATE.

// Shows the main app screen.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
});