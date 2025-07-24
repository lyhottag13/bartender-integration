import pool from './src/db.js';
import { getISOWeek } from 'date-fns';
import port from './src/port.js';
import cors from 'cors';

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

app.use(cors());

// Sets http options for Integration Builder, otherwise it doesn't take the POST
app.options('/api/send', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(204); // 204 is more appropriate than 200 for preflight
});

// Shows the main app screen.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.post('/api/send', async (req, res) => {
    const { startIndex, endIndex, override } = req.body;
    const copies = endIndex - startIndex + 1;

    const serialArray = [];
    const responseObject = {};


    for (let i = 0; i < copies; i++) {
        const currentSerial = `00000${Number.parseInt(startIndex) + i}`.slice(-5);
        serialArray.push(currentSerial);
    }

    const uniquePrintResults = await isUniquePrint(serialArray);
    if (!uniquePrintResults.unique && !override) {
        responseObject.err = `Numeros ya impresados: ${uniquePrintResults.range}`;
        res.json(responseObject);
        return;
    }
    const successfulPrint = await handlePrint(serialArray, copies);
    if (successfulPrint) {
        const successfulInsert = await insertSerials(serialArray);
        responseObject.successfulInsert = successfulInsert;
    }
    res.json(responseObject);
});

app.post('/api/password', (req, res) => {
    const { password } = req.body;
    if (password === 'bartending!2025') {
        res.json({ successfulPassword: true });
    } else {
        res.json({ sucessfulPassword: false });
    }
});

async function handlePrint(serialArray, copies) {
    const year = new Date().getFullYear().toString();
    const datecode = `${year.slice(-2)}${getISOWeek(new Date())}`;
    const startSerial = `APBUESA${datecode + serialArray[0]}`;
    const { Status } = await sendPrint(startSerial, copies);
    const successfulPrint = Status === 'RanToCompletion';
    return successfulPrint;
}

/**
 * Checks if the serials have already been printed by SELECTing them in the
 * bartender_printed table. If they're not in the table, then they haven't
 * been printed yet, and this function returns true.
 * @param {string[]} serialArray The serial numbers that will be checked 
 *                               against the database.
 * @returns An object with the success of the uniqueness
 */
async function isUniquePrint(serialArray) {
    let sqlString = 'SELECT * FROM bartender_printed WHERE';
    for (let i = 0; i < serialArray.length; i++) {
        sqlString += `${i !== 0 ? ' OR' : ''} serial_number LIKE ?`;
    }
    const serialArrayWildcard = serialArray.map(serial => `%${serial}`);
    const [rows] = await pool.execute(sqlString, serialArrayWildcard);
    const existingSerials = rows.map(row => row.serial_number);
    console.log(existingSerials);
    if (existingSerials.length > 0) {
        const range = `${Math.min(...existingSerials)} - ${Math.max(...existingSerials)}`;
        console.log(range);
        return { unique: false, range };
    }
    return { unique: true };
}

async function insertSerials(serialArray) {
    let sqlString = `INSERT INTO bartender_printed (serial_number) VALUES (?)`;
    // Starts at i = 1 since we already inserted one ?.
    for (let i = 1; i < serialArray.length; i++) {
        sqlString += ', (?)';
    }
    try {
        await pool.query(sqlString, serialArray);
        return true;
    } catch (err) {
        return false;
    }
}

async function sendPrint(startSerial, copies) {
    const data = await (await fetch('http://localhost:3010/Integration/WebServiceIntegration/Execute', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            SerialNumber: startSerial,
            Copies: copies
        })
    })).json();
    return data;
}