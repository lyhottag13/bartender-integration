import elements from "./utils/elements.js";
import toggleModal from "./utils/printingModal.js";

/**
 * Initializes everything on the page. Adds event listeners and resets the
 * page to a new state.
 */
async function main() {
    document.addEventListener('keypress', handleKeyPress);
    elements.printButton.addEventListener('click', handleSubmit);
    elements.reprintButton.addEventListener('click', handleSubmit);
    
    // Fetches the datecode from the server because otherwise we need a long CDN import.
    const { datecode } = await (await fetch('/api/getDatecode')).json();
    elements.datecode.innerText = `Datecode: ${datecode}`;

    elements.startIndexInput.oninput = function () {
        this.value = this.value.replace(/[^0-9]/g, '');
    };
    elements.endIndexInput.oninput = function () {
        this.value = this.value.replace(/[^0-9]/g, '');
    };
    reset();
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
    if (e.target === elements.reprintButton) {
        // Asks for a password and checks if it's correct.
        const password = window.prompt('Ingresa contraseña:');
        const isValidPassword = await submitPassword(password);
        if (!isValidPassword) {
            window.alert('Contraseña invalida');
            return;
        }
        window.alert('Contraseña correcta!');
        override = true;
    }
    toggleButtons(false);
    toggleModal(true);
    const printData = await handlePrint(startIndex, endIndex, override);
    if (printData.err) {
        window.alert(`Algo fue mal:\n${printData.err}`);
    } else {
        window.alert('Impresion exitosa');
    }
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
    return { success: true };
}

/**
 * Sends the data to the server to print and add to the database.
 * @param {number} startIndex 
 * @param {number} endIndex 
 * @param {boolean} override 
 * @returns The data associated with the print fetch.
 */
async function handlePrint(startIndex, endIndex, override) {
    const data = await (await fetch('/api/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            startIndex,
            endIndex,
            override
        })
    })).json();
    return data;
}

/**
 * Submits the password to the server for validation. This is done server-side
 * because it's safer, though it's unlikely a hacker is going to do much harm
 * by printing stickers. 
 * @param {string} password 
 * @returns Whether the password was correct.
 */
async function submitPassword(password) {
    const { successfulPassword } = await (await fetch('/api/password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            password
        })
    })).json();
    return successfulPassword;
}

/**
 * Resets the inputs so that they have no value.
 */
function reset() {
    elements.startIndexInput.value = '';
    elements.endIndexInput.value = '';
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
