import pool from './src/db.js';
import { getISOWeek } from 'date-fns';
import port from './src/port.js';
import hostname from './src/hostname.js';

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

app.post('/api/send', async (req, res) => {
    const { startIndex, endIndex, override } = req.body;
    /*
    The number of serializations to perform. Plus one since the first number is
    also printed. For example, if I print 100 to 101, then copies = 101 - 100 which
    is one. However, I want to print 100 and 101, which is two, so the program
    includes a plus one.
    */
    const copies = endIndex - startIndex + 1;

    const serialArray = []; // An array of serial numbers, only the five digits at the end.
    const responseObject = {}; // The object that will be res'ed to the client.


    // Builds the serialArray with every serial between startIndex and endIndex.
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
    // Builds the starting serial number for the printer to start with.
    const year = new Date().getFullYear().toString();
    const datecode = `${year.slice(-2)}${getISOWeek(new Date())}`;
    const startSerial = `APBUESA${datecode + serialArray[0]}`;

    // Sends the print and checks the status of the print.
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
    // Prepends a % to each serial number since it helps in the query by acting as a wildcard.
    const serialArrayWildcard = serialArray.map(serial => `%${serial}`);
    const [rows] = await pool.execute(sqlString, serialArrayWildcard);

    // Only takes the serial numbers from each row, and removes the MySQL primary key.
    const existingSerials = rows.map(row => row.serial_number);

    console.log('Existing Serials:', existingSerials.length === 0 ? 'None!' : existingSerials);
    if (existingSerials.length > 0) {
        // Finds the minimum and maximum in the serials that already exist to return a range.
        const range = `${Math.min(...existingSerials)} - ${Math.max(...existingSerials)}`;
        console.log('Range:', range); // Server-side debug.
        return { unique: false, range };
    }
    return { unique: true };
}

/**
 * Inserts the serial numbers from serialArray into the database so that the
 * app can eventually query new numbers against the database. This prevents
 * duplicate stickers from accidentally being printed.
 * @param {string[]} serialArray 
 * @returns 
 */
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

/**
 * Sends the printing parameters to the Integration Builder app's API. The API
 * might change locations or IP address, so it's a good idea to have the hostname
 * be variable.
 * @param {string} startSerial 
 * @param {number} copies 
 * @returns 
 */
async function sendPrint(startSerial, copies) {
    const printData = await (await fetch(`http://${hostname}:3010/Integration/WebServiceIntegration/Execute`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            SerialNumber: startSerial,
            Copies: copies
        })
    })).json();
    return printData;
}