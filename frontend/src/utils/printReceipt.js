// A separate document keeps the dashboard, modal controls and scroll limits out
// of the print job. Windows handles USB printers through their installed driver.
export async function printReceipt(receipt) {
    if (!receipt) throw new Error('Receipt is unavailable');
    const frame = document.createElement('iframe');
    frame.title = 'Receipt printing';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:58mm;height:1px;border:0;';
    document.body.appendChild(frame);
    const cleanup = () => frame.remove();
    try {
        const doc = frame.contentDocument;
        doc.open();
        doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>FLUX Receipt</title>
            <style>
                @page { margin: 0; }
                html, body { margin: 0; padding: 0; width: 58mm; background: white; }
                body { font-family: 'Courier New', Courier, monospace; }
                * { box-sizing: border-box; color: black !important; }
                #receipt { width: 48mm; margin: 0 auto; padding: 3mm 0 !important; }
                #receipt img { width: 20mm !important; height: 20mm !important; }
                #receipt p, #receipt span { overflow-wrap: anywhere; }
            </style></head><body></body></html>`);
        doc.close();
        const copy = receipt.cloneNode(true);
        copy.id = 'receipt';
        doc.body.appendChild(copy);
        await Promise.all(Array.from(doc.images, img => new Promise(resolve => {
            if (img.complete) return resolve();
            img.onload = resolve;
            img.onerror = () => { img.style.display = 'none'; resolve(); };
            setTimeout(resolve, 3000);
        })));
        frame.contentWindow.addEventListener('afterprint', cleanup, { once: true });
        frame.contentWindow.focus();
        frame.contentWindow.print();
        // Fallback for browsers that do not dispatch afterprint on the iframe.
        setTimeout(cleanup, 300000);
    } catch (error) {
        cleanup();
        throw error;
    }
}
