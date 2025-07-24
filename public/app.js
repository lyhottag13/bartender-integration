const button = document.getElementById('submit');
const startIndexInput = document.getElementById('start-index');
const endIndexInput = document.getElementById('end-index');

async function main() {
    document.addEventListener('keypress', handleKeyPress)
    button.addEventListener('click', handleSubmit);
    startIndexInput.oninput = function () {
        this.value = this.value.replace(/[^0-9]/g, '');
    }
    endIndexInput.oninput = function () {
        this.value = this.value.replace(/[^0-9]/g, '');
    }
    reset();
}

async function handleSubmit() {
    if (!window.prompt('Enviar?')) {
        return;
    }
    const startIndex = startIndexInput.value;
    const endIndex = endIndexInput.value;
    button.disabled = true;

    if (isValidInput(startIndex, endIndex)) {
        const successfulPrint = await handlePrint(startIndex, endIndex);
    }
    button.disabled = false;
}

function handleKeyPress(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
    }
}

function isValidInput(startIndex, endIndex) {
    let errorMessage = '';
    let warningMessage = '';

    // If either the startIndex or endIndex don't exist, don't submit anything.
    if (!startIndex || !endIndex) {
        errorMessage += 'Ingresa índices\n';
    }
    if (endIndex < startIndex) {
        errorMessage += 'Números no válidos\n';
    }

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

async function handlePrint(startIndex, endIndex) {
    const data = await (await fetch('/api/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            startIndex,
            endIndex
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

function reset() {
    startIndexInput.value = '';
    endIndexInput.value = '';
}

main();