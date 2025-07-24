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
    const startIndex = startIndexInput.value;
    const endIndex = endIndexInput.value;


    if (isValidInput(startIndex, endIndex)) {
        const successfulPrint = await handlePrint(startIndexInput.value, endIndexInput.value);
    }
}

function handleKeyPress(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
    }
}

function isValidInput(startIndex, endIndex) {
    let errorMessage = '';

    // If either the startIndex or endIndex don't exist, don't submit anything.
    if (!startIndex || !endIndex) {
        errorMessage += 'Ingresa índices\n';
    }
    if (endIndex < startIndex) {
        errorMessage += 'Números no válidos\n';
    }
    if (errorMessage || window.prompt('Password?') !== 'bartending!2025') {
        window.alert(errorMessage);
        return false;
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