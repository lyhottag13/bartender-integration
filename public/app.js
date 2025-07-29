import elements from "./utils/elements.js";
import toggleModal from "./utils/printingModal.js";

async function main() {
    document.addEventListener('keypress', handleKeyPress);
    elements.printButton.addEventListener('click', handleSubmit);
    elements.reprintButton.addEventListener('click', handleSubmit);

    elements.startIndexInput.oninput = function () {
        this.value = this.value.replace(/[^0-9]/g, '');
    };
    elements.endIndexInput.oninput = function () {
        this.value = this.value.replace(/[^0-9]/g, '');
    };
    reset();
    const { datecode } = await (await fetch('/api/getDatecode')).json();
    elements.datecode.innerText = `Datecode: ${datecode}`;
}

async function handleSubmit(e) {
    console.log(e);
    if (!window.confirm('Enviar?')) {
        return;
    }

    const startIndex = Number(elements.startIndexInput.value);
    const endIndex = Number(elements.endIndexInput.value);
    toggleButtons(false);

    const checkInputData = checkInput(startIndex, endIndex);
    if (checkInputData.err) {
        window.alert(checkInputData.err);
        toggleButtons(true);
        return;
    }
    if (checkInputData.warn) {
        const confirm = window.confirm(checkInputData.warn);
        if (!confirm) {
            toggleButtons(true);
            return;
        }
    }
    // Handles the reprint override.
    let override = false;
    if (e.target === elements.reprintButton) {
        // Asks for a password and checks if it's correct.
        const password = window.prompt('Ingresa contraseña:');
        const isValidPassword = await submitPassword(password);
        if (!isValidPassword) {
            window.alert('Contraseña invalida');
            toggleButtons(true);
            return;
        }
        window.alert('Contraseña correcta!');
        override = true;
    }
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
    elements.startIndexInput.value = '';
    elements.endIndexInput.value = '';
}

function toggleButtons(enabled) {
    elements.printButton.class = enabled ? 'button-hover' : '';
    elements.printButton.style.filter = enabled ? '' : 'brightness(0.7)';
    elements.reprintButton.class = enabled ? 'button-hover' : '';
    elements.reprintButton.style.filter = enabled ? '' : 'brightness(0.7)';
    elements.printButton.disabled = !enabled;
    elements.reprintButton.disabled = !enabled;
}

main();
