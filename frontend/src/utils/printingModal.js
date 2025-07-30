import elements from "./elements.js";

let counter = 1;
setInterval(() => {
    let dots = counter;
    if (counter === 3) {
        counter = 0;
    }
    elements.modalText.innerText = 'Printing';
    for (let i = 0; i < dots; i++) {
        elements.modalText.innerText += '.';
    }
    counter++;
}, 300);

export default function toggleModal(enabled) {
    elements.modal.style.top = enabled ? '50vh' : '100vh';
    elements.modal.style.transform = `translateX(-50%) translateY(${enabled ? '-50%' : '0'})`;
}