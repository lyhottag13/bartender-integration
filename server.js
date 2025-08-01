import pool from './src/db.js';
import port from './src/port.js';
import hostname from './src/hostname.js';
import cors from 'cors';

// START BOILERPLATE.

import path from 'path';
import express, { response } from 'express';
import { fileURLToPath } from 'url';
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dependencies for the app to read user input and to return JSONs.
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.urlencoded({ extended: true }));

app.listen(port, '0.0.0.0', () => {
    console.log(`App running on port ${port}`);
});

// END BOILERPLATE.

// Shows the main app screen.
// app.get('*', (req, res) => {
//     res.sendFile(path.join(__dirname, 'dist', 'index.html'));
// });

app.post('/api/send', async (req, res) => {
    const { startIndex, endIndex, override, datecode } = req.body;
    /*
    The number of serializations to perform. Plus one since the first number is
    also printed. For example, if I print 100 to 101, then copies = 101 - 100 which
    is one. However, I want to print 100 and 101, which is two, so the program
    includes a plus one.
    */
    const copies = endIndex - startIndex + 1;

    // const serialArray = []; // An array of serial numbers, only the five digits at the end.
    const responseObject = {}; // The object that will be res'ed to the client.

    // Builds the serialArray with every serial between startIndex and endIndex.
    const serialArray = Array.from({ length: copies }, (_, i) => {
        return String(startIndex + i).padStart(5, '0');
    });

    const uniquePrintData = await isUniquePrint(serialArray);
    if (uniquePrintData.err) {
        const isOverridden = uniquePrintData.overridable && override;
        if (!isOverridden) {
            responseObject.err = uniquePrintData.err;
            res.json(responseObject);
            return;
        }
    }

    const startSerial = `APBUAESA${datecode + serialArray[0]}`
    const printData = await handlePrint(startSerial, copies);
    if (printData.err) {
        responseObject.err = printData.err;
        res.json(responseObject);
        return;
    }

    const insertData = await insertSerials(serialArray);
    if (insertData.err) {
        responseObject.err = insertData.err;
        res.json(responseObject);
        return;
    }
    // If everything went smoothly, the responseObject return has no err.
    res.json({});
});

app.post('/api/password', (req, res) => {
    const { password } = req.body;
    if (password !== 'bartending!2025') {
        res.json({ err: 'Contraseña inválida' });
        return;
    }
    res.json({});
});

/**
 * Sends the printing parameters to the Integration Builder app's API. The API
 * might change locations or IP address, so it's a good idea to have the hostname
 * be variable.
 * @param {string} startSerial The starting serial number, as APBUAESAXXXX00000
 * @param {number} copies The number of serializations.
 * @returns An error, if there was one.
 */
async function handlePrint(startSerial, copies) {
    try {
        // Sends the print and checks the status of the print.
        const response = await fetch(`http://${hostname}:3010/Integration/WebServiceIntegration/Execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                SerialNumber: startSerial,
                Copies: copies
            })
        });
        if (!response.ok) {
            throw new Error('Something went wrong with the API call.');
        }
        const printData = await response.json();
        if (printData.Status !== 'RanToCompletion') {
            return { err: 'Algo salió mal con la impresión.' };
        }
        return {};
    } catch (err) {
        console.log(err.stack);
        return { err: 'No se pudo conectar a Integration Builder.' };
    }
}

/**
 * Checks if the serials have already been printed by SELECTing them in the
 * bartender_printed table. If they're not in the table, then they haven't
 * been printed yet, and this function returns true.
 * @param {string[]} serialArray The serial numbers that will be checked 
 *                               against the database.
 * @returns An error, if there is any.
 */
async function isUniquePrint(serialArray) {
    const sqlString = 'SELECT serial_number FROM bartender_printed WHERE serial_number BETWEEN ? AND ?';
    const firstSerialNumber = serialArray[0];
    const lastSerialNumber = serialArray.at(-1);
    try {
        const [rows] = await pool.execute(sqlString, [firstSerialNumber, lastSerialNumber]);

        // Maps the serial_number properties of each row to become an array.
        const existingSerials = rows.map(row => row.serial_number);

        console.log('Existing Serials:', existingSerials.length === 0 ? 'None!' : existingSerials); // Server-side debug.
        if (existingSerials.length > 0) {
            // Finds the minimum and maximum in the serials that already exist to return a range.
            const min = Math.min(...existingSerials);
            const max = Math.max(...existingSerials);
            const range = `${min} - ${max}`;

            console.log('Range:', range); // Server-side debug.
            return { err: `Numeros ya impresos: ${range}`, overridable: true };
        }
        return {};
    } catch (err) {
        console.log(err.stack); // Server-side debug.
        return { err: err.message };
    }
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
        return {};
    } catch (err) {
        console.log(err.stack);
        return { err: 'No se pudo insertar en la base de datos.' };
    }
}


