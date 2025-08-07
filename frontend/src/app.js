import elements from "./utils/elements.js";
import toggleModal from "./utils/printingModal.js";
import { getISOWeek } from 'date-fns';

/**
 * Initializes everything on the page. Adds event listeners and resets the
 * page to a new state.
 */
async function main() {
    const filterLetters = function () {
        this.value = this.value.replace(/[^0-9]/g, '');
    }
    document.addEventListener('keypress', handleKeyPress);
    elements.printButton.addEventListener('click', handleSubmit);
    elements.reprintButton.addEventListener('click', handleSubmit);
    elements.downloadButton.addEventListener('click', () => {
        window.open('/api/excel');
    });

    elements.datecode.innerText = `Datecode: ${getDatecode()}`;

    elements.startIndexInput.oninput = filterLetters;
    elements.endIndexInput.oninput = filterLetters;
    reset();


}

async function setMax() {
    const { max } = await getMax();
    elements.highest.innerText = `Last: ${max}`;
}

/**
 * Handles the user clicking either the print or reprint button.
 * Checks the input data for validity, works out whether the user input a valid
 * password if they hit reprint, and continues with the printing process.
 * @param {Event} e The event fired by the user interacting with the button.
 * @returns Nothing, only returns are early returns for logic.
 */
async function handleSubmit(e) {
    console.log(e);
    if (!window.confirm('Enviar?')) {
        return;
    }

    // Wraps into Numbers because the value comparisons act odd with strings of numbers.
    const startIndex = Number(elements.startIndexInput.value);
    const endIndex = Number(elements.endIndexInput.value);
    const checkInputData = checkInput(startIndex, endIndex);
    if (checkInputData.err) {
        window.alert(checkInputData.err);
        return;
    }
    if (checkInputData.warn) {
        const confirm = window.confirm(checkInputData.warn);
        if (!confirm) {
            return;
        }
    }
    // Handles the reprint override.
    let override = false; // Overrides the print cancellation if there are repeat indices.
    let newDatecode;
    if (e.target === elements.reprintButton) {
        // Asks for a password and checks if it's correct.
        const password = window.prompt('Ingresa contraseña:');
        const passwordData = await submitPassword(password);
        if (passwordData.err) {
            window.alert(passwordData.err);
            return;
        }
        newDatecode = window.prompt('Ingresa datecode nuevo.');
        const datecodeData = checkDatecode(newDatecode);
        if (datecodeData.err) {
            window.alert(`Datecode invalido:\n${datecodeData.err}`);
            return;
        }
        // Wraps the datecode as a number to have data types be consistent.
        newDatecode = Number(newDatecode);
        override = true;
    }
    toggleButtons(false);
    toggleModal(true);
    const datecode = override ? newDatecode : getDatecode();
    const printData = await handlePrint(startIndex, endIndex, override, datecode);
    if (printData.err) {
        window.alert(`Algo fue mal:\n${printData.err}`);
    } else {
        window.alert('Impresion exitosa');
    }
    reset();
    toggleModal(false);
    toggleButtons(true);
}

/**
 * Handles the user's keypress. If it's an enter, then it runs the print button.
 * @param {Event} e The event fired by a key press.
 */
function handleKeyPress(e) {
    if (e.key === 'Enter' && !elements.printButton.disabled) {
        e.preventDefault();
        handleSubmit(e);
    }
}

/**
 * Checks the inputs for validity. There is a capacity for both errors and
 * warnings, but this errors take priority in this function.
 * @param {number} startIndex The starting index for the print.
 * @param {number} endIndex The ending index of the print.
 * @returns An error/warning stating the inputs' status, if there is one.
 */
function checkInput(startIndex, endIndex) {
    let errorMessage = '';
    let warningMessage = '';

    if (!startIndex || !endIndex) {
        errorMessage += 'Ingresa índices\n';
    }
    if (endIndex < startIndex) {
        errorMessage += 'Números no válidos\n';
    }

    if (endIndex - startIndex > 500) {
        errorMessage += 'No se puede impirimir mas de 500 a la vez';
    }

    if (endIndex - startIndex > 100) {
        warningMessage += 'Imprimiendo mas de 100\n';
    }

    if (errorMessage) {
        return { err: errorMessage };
    }

    if (warningMessage) {
        return { warn: warningMessage };
    }
    return {};
}

/**
 * Sends the data to the server to print and add to the database.
 * @param {number} startIndex 
 * @param {number} endIndex 
 * @param {boolean} override 
 * @param {number} datecode 
 * @returns An error, if there is any.
 */
async function handlePrint(startIndex, endIndex, override, datecode) {
    try {
        const response = await fetch('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                startIndex,
                endIndex,
                override,
                datecode
            })
        });
        const printData = await response.json();
        if (!response.ok) {
            throw new Error(printData.err || 'Something went wrong with the API call.');
        }
        if (printData.err) {
            return { err: printData.err };
        }
        return {};
    } catch (err) {
        return { err: err.message };
    }
}

/**
 * Submits the password to the server for validation. This is done server-side
 * because it's safer, though it's unlikely a hacker is going to do much harm
 * by printing stickers. 
 * @param {string} password 
 * @returns Whether the password was correct.
 */
async function submitPassword(password) {
    try {
        const response = await fetch('/api/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        if (!response.ok) {
            throw new Error(`Something went wrong with the API call.`);
        }
        const passwordData = await response.json();
        if (passwordData.err) {
            return { err: passwordData.err }
        }
        return {};

    } catch (err) {
        console.log(err.stack); // Client-side debug.
        return { err: err.message };
    }
}

/**
 * Gets the current datecode as four digits, YYWW. The YY are the
 * final digits of the current year, so in 2025 it's 25, and the WW are the
 * digits of the current week.
 * @returns The current datecode.
 */
function getDatecode() {
    // Builds the current datecode.
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);

    // Week is padded since it can return just single digit numbers, and we want 01, not 1.
    const week = getISOWeek(now).toString().padStart(2, '0');

    const datecode = Number(`${year}${week}`);
    return datecode;
}

async function getMax() {
    try {
        const response = await fetch('/api/max');
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.err || 'getMax error');
        }
        return { max: data.max };
    } catch (err) {
        console.log(err.stack);
        return { err: err.message };
    }
}

/**
 * Checks whether the datecode is valid. There are three validations.
 * @param {string} newDatecode The user input datecode.
 * @returns The error messages associated with the datecode.
 */
function checkDatecode(newDatecode) {
    let err = '';
    if (newDatecode.length !== 4) {
        err += 'Longitud de datecode invalido\n';
    }
    if (!/\d/.test(newDatecode)) {
        err += 'Datecode solo acepta digitos\n';
    }
    if (Number(newDatecode.slice(2)) > 52) {
        err += 'Semana de datecode invalida\n';
    }
    return { err };
}

/**
 * Resets the inputs so that they have no value.
 */
async function reset() {
    elements.startIndexInput.value = '';
    elements.endIndexInput.value = '';
    setMax();
}

/**
 * Toggles the buttons to be enabled or disabled, based on the parameters.
 * @param {boolean} enabled The desired state of the buttons.
 */
function toggleButtons(enabled) {
    elements.printButton.class = enabled ? 'button-hover' : '';
    elements.printButton.style.filter = enabled ? '' : 'brightness(0.7)';
    elements.reprintButton.class = enabled ? 'button-hover' : '';
    elements.reprintButton.style.filter = enabled ? '' : 'brightness(0.7)';
    elements.printButton.disabled = !enabled;
    elements.reprintButton.disabled = !enabled;
}

main();
