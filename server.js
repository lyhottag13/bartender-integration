import pool from './src/db.js';
import port from './src/port.js';
import hostname from './src/hostname.js';
import cors from 'cors';
import ExcelJS from 'exceljs';

// START BOILERPLATE.

import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dependencies for the app to read user input and to return JSONs.
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.urlencoded({ extended: true }));

app.listen(port, '127.0.0.1', () => {
    console.log(`App running on port ${port}`);
});

// END BOILERPLATE.

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
    /** Array of serial numbers as '00000' @type {string[]} */
    const serialArray = Array.from({ length: copies }, (_, i) => {
        return String(startIndex + i).padStart(5, '0');
    });

    const uniquePrintData = await checkUniquePrint(serialArray);
    if (uniquePrintData.err) {
        const isOverridden = uniquePrintData.overridable && override;
        if (!isOverridden) {
            responseObject.err = uniquePrintData.err;
            return res.status(400).json(responseObject);
        }
    }

    const checkSkipData = await checkSkip(serialArray[0]);
    if (checkSkipData.err) {
        responseObject.err = checkSkipData.err;
        return res.status(400).json(responseObject);
    }

    const startSerial = `APBUAESA${datecode + serialArray[0]}`
    const printData = await handlePrint(startSerial, copies);
    if (printData.err) {
        responseObject.err = printData.err;
        return res.status(500).json(responseObject);
    }

    const insertData = await insertSerials(serialArray);
    if (insertData.err) {
        responseObject.err = insertData.err;
        return res.status(500).json(responseObject);
    }

    const metadataData = await insertMetadata(serialArray, datecode, override);
    if (metadataData.err) {
        responseObject.err = metadataData.err;
        return res.status(500).json(responseObject);
    }
    // If everything went smoothly, the responseObject return has no err.
    return res.status(200).json({});
});

app.post('/api/password', (req, res) => {
    const { password } = req.body;
    if (password !== 'bartending!2025') {
        res.json({ err: 'Contraseña inválida' });
        return;
    }
    res.json({});
});

app.get('/api/max', async (_req, res) => {
    try {
        const maxData = await getMax();
        if (maxData.err) {
            throw new Error(maxData.err);
        }
        return res.status(200).json({ max: maxData.max });
    } catch (err) {
        console.log(err.stack);
        return res.status(500).json({ err: err.message });
    }
});

app.get('/api/excel', async (_req, res) => {
    try {
        const sqlString = 'SELECT * FROM bartender_batch';
        const [rows] = await pool.query(sqlString);

        // Creates the Excel workbook.
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Batch Jobs');

        sheet.columns = [
            { header: 'Range Start', key: 'rangeStart', width: 15 },
            { header: 'Range End', key: 'rangeEnd', width: 15 },
            { header: 'Datecode', key: 'datecode', width: 12 },
            { header: 'Reprint', key: 'reprint', width: 10 },
            { header: 'Datetime', key: 'datetime', width: 22, style: { numFmt: 'yyyy-mm-dd hh:mm:ss' } }
        ];

        rows.forEach((row, index) => {
            const newRow = sheet.addRow([
                row.range_start,
                row.range_end,
                row.datecode,
                row.reprint,
                row.datetime
            ]);
            newRow.alignment = { vertical: 'middle', horizontal: 'center' };
            const isEven = index % 2 === 0;
            newRow.eachCell({ includeEmpty: false }, cell => cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: isEven ? 'FFF0F8FF' : 'FFD6ECFA' }
            });
        });


        // Formats the header row.
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 15 };
        headerRow.eachCell({ includeEmpty: false }, cell => cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF000080' }, // Dark blue background
        });
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 30;

        // Sets the header so that the Excel file is processed correctly.
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="BarTender Batch Prints.xlsx"');

        // Sends the Excel file.
        await workbook.xlsx.write(res);
        res.status(200).end();
    } catch (err) {
        console.log(err.stack);
        res.status(500).send({ err: err.message });
    }
})

/**
 * Checks if there is a skip in the prints, e.g. a user printed 32, when
 * the last index printed was 30, so 31 is skipped.
 * @param {string} firstSerial The first serial in the range, as '00000'.
 * @returns An error, if there is any.
 */
async function checkSkip(firstSerial) {
    const maxData = await getMax();
    if (maxData.err) {
        return { err: maxData.err }
    }
    const nextSerial = Number(maxData.max) + 1;

    /* 
    If the first serial to print is greater than the next serial, then we don't print.
    The reason we don't do !== is because we can have reprints for indices that are
    below the next serial.
    */
    if (Number(firstSerial) > nextSerial) {
        return { err: 'El primer indice no sigue la secuencia. Consulta el valor de "Last".' }
    }
    return {};
}

/**
 * Gets the maximum serial number printed.
 * @returns {string} An error or the max of the serial numbers printed.
 */
async function getMax() {
    try {
        const sqlString = `SELECT MAX(serial_number) as max FROM bartender_printed`;
        const [[{ max }]] = await pool.query(sqlString);
        return { max };
    } catch (err) {
        console.log(err.stack);
        return { err: err.message };
    }
}

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
async function checkUniquePrint(serialArray) {
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
    try {
        // Creates a new (?) for every serial, useful for the SQL query.
        const placeholders = serialArray.map(() => '(?)');
        let sqlString = `INSERT INTO bartender_printed (serial_number) VALUES ${placeholders.join(', ')}`;
        await pool.query(sqlString, serialArray);
        return {};
    } catch (err) {
        console.log(err.stack);
        return { err: 'No se pudo insertar en la base de datos.' };
    }
}

/**
 * Inserts the metadata about the print into a metadata table, useful for
 * the administrators of the Breville line.
 * @param {string[]} serialArray A collection of the serial arrays printed.
 * @param {number} datecode The datecode used in the print.
 * @param {boolean} reprint Whether the print was a reprint.
 * @returns An error, if there is any.
 */
async function insertMetadata(serialArray, datecode, reprint) {
    try {
        const columns = [
            'range_start',
            'range_end',
            'datecode',
            'reprint',
            'datetime'
        ];

        // Makes a placeholder ? for each column.
        const placeholders = columns.map(() => '?');

        const values = [
            Number(serialArray[0]),
            Number(serialArray.at(-1)),
            datecode,
            reprint,
            new Date().toLocaleString('en-CA', { hour12: false }).replace(',', '')
        ];

        const sqlString = `INSERT INTO bartender_batch (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
        await pool.query(sqlString, values);
        return {};
    } catch (err) {
        console.log(err.stack);
        return { err: 'No se pudo insertar en Metadata.' };
    }
}


