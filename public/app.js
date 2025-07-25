const printButton = document.getElementById('print');
const reprintButton = document.getElementById('reprint');
const startIndexInput = document.getElementById('start-index');
const endIndexInput = document.getElementById('end-index');

async function main() {
    document.addEventListener('keypress', handleKeyPress)
    printButton.addEventListener('click', handleSubmit);
    reprintButton.addEventListener('click', handleSubmit);

    startIndexInput.oninput = function () {
        this.value = this.value.replace(/[^0-9]/g, '');
    }
    endIndexInput.oninput = function () {
        this.value = this.value.replace(/[^0-9]/g, '');
    }
    reset();
}

async function handleSubmit(e) {
    console.log(e);
    if (!window.confirm('Enviar?')) {
        return;
    }
    const startIndex = startIndexInput.value;
    const endIndex = endIndexInput.value;
    printButton.disabled = true;
    reprintButton.disabled = true;

    if (isValidInput(startIndex, endIndex)) {
        // If the reprintButton was pressed, then run a special override.
        if (e.target === reprintButton) {
            const successfulPassword = await submitPassword(window.prompt('Ingresa contraseña'));
            if (successfulPassword) {
                await handlePrint(startIndex, endIndex, true);
                return;
            }
        } else {
            const successfulPrint = await handlePrint(startIndex, endIndex);
        }
    }
    printButton.disabled = false;
    reprintButton.disabled = false;
}

/**
 * Handles when the user presses enter while on the print screen.
 * @param {event} e The event that fires when the user presses enter.
 */
function handleKeyPress(e) {
    if (e.key === 'Enter' && !printButton.disabled) {
        e.preventDefault();
        handleSubmit(e);
    }
}

function isValidInput(startIndex, endIndex) {
    let errorMessage = '';
    let warningMessage = '';

    // If either the startIndex or endIndex don't exist, don't submit anything.
    if (!startIndex || !endIndex) {
        errorMessage += 'Ingresa índices\n';
    }

    // If the endIndex is before the startIndex, the numbers were invalid.
    if (endIndex < startIndex) {
        errorMessage += 'Números no válidos\n';
    }

    // Warns the user if the difference in start and end indexes surpasses a number.
    if (endIndex - startIndex > 100) {
        warningMessage += 'Imprimiendo mas de 100\n';
    }

    if (errorMessage) {
        window.alert(errorMessage);
        return false;
    }

    if (warningMessage) {
        const confirm = window.confirm(warningMessage);
        if (!confirm) {
            return;
        }
    }
    return true;
}

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
    if (data.err) {
        window.alert(`Algo fue mal:\n${data.err}`);
        return false;
    } else {
        window.alert('Impresión exitosa');
        return true;
    }
}

async function submitPassword(password) {
    const { successfulPassword } = await (await fetch('/api/password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: `{"password":"${password}"}`
    })).json();
    return successfulPassword;
}

function reset() {
    startIndexInput.value = '';
    endIndexInput.value = '';
}

main();