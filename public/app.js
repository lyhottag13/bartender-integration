const elements = {
    printButton: document.getElementById('print'),
    reprintButton: document.getElementById('reprint'),
    startIndexInput: document.getElementById('start-index'),
    endIndexInput: document.getElementById('end-index'),
    datecode: document.getElementById('datecode')
};

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
    const {datecode} = await (await fetch('/api/getDatecode')).json();
    elements.datecode.innerText = `Datecode: ${datecode}`;
}

async function handleSubmit(e) {
    console.log(e);
    if (!window.confirm('Enviar?')) {
        return;
    }

    const startIndex = elements.startIndexInput.value;
    const endIndex = elements.endIndexInput.value;
    elements.printButton.disabled = true;
    elements.reprintButton.disabled = true;

    if (isValidInput(startIndex, endIndex)) {
        if (e.target === elements.reprintButton) {
            const successfulPassword = await submitPassword(window.prompt('Ingresa contraseña'));
            if (successfulPassword) {
                await handlePrint(startIndex, endIndex, true);
                return;
            }
        } else {
            const successfulPrint = await handlePrint(startIndex, endIndex);
        }
    }
    elements.printButton.disabled = false;
    elements.reprintButton.disabled = false;
}

function handleKeyPress(e) {
    if (e.key === 'Enter' && !elements.printButton.disabled) {
        e.preventDefault();
        handleSubmit(e);
    }
}

function isValidInput(startIndex, endIndex) {
    let errorMessage = '';
    let warningMessage = '';

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
    elements.startIndexInput.value = '';
    elements.endIndexInput.value = '';
}

main();
