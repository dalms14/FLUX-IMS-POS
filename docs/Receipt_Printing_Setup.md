# Automatic receipt printing

After Confirm Order successfully saves a sale, FLUX requests one receipt print job. The receipt screen has only **New Order**. A failed checkout does not print, and printing failures do not resubmit the order. Reprint a saved receipt from **Transactions**.

Normal browser mode opens the browser print dialog automatically. Printing without another confirmation requires the cashier's browser to run in a mode that permits automatic printing.

## Brave on the Windows cashier computer

1. Install the receipt printer's Windows driver and confirm a Windows test page prints.
2. In Windows **Settings → Bluetooth & devices → Printers & scanners**, turn off **Let Windows manage my default printer**, then set the receipt printer as the default. Configure its driver for the installed paper width. FLUX's existing receipt layout uses 58 mm paper.
3. Double-click **Start FLUX Printing.cmd** in the repository root. It opens the live site, `https://fluxcafe.store/items`, in a separate Brave app window with `--kiosk-printing`. Opening the site in an ordinary Brave tab does not enable silent printing.
4. For local development instead, start the FLUX frontend and backend, then run `"Start FLUX Printing.cmd" --local` from Command Prompt in the repository root. This opens `http://localhost:3000/items`. The launcher does not start the FLUX servers or change the default printer.
5. Sign in again in this separate FLUX browser profile. Use **Transactions** to print an existing receipt and check the actual output before using the checkout flow with customers.

Use this launcher for the cashier session each time. Its profile is stored in `%LOCALAPPDATA%\FLUX-POS\BravePrinting`; ordinary Brave windows keep their own settings. Close the dedicated FLUX window before relaunching it if it was opened without the printing flag. Keep this profile for the trusted FLUX application.

If a preview or Save as PDF dialog appears, verify that the physical receipt printer is installed and set as default and that the cashier window was opened through the launcher. To check the flag, open `brave://version` in the dedicated profile and look for `--kiosk-printing` in **Command Line**. Driver settings and actual paper output still need to be tested on the cashier computer.

FLUX can request printing but cannot confirm that paper came out, detect a cancelled browser dialog, or automatically recover an offline printer. If printing is cancelled or the printer fails, keep the saved sale and reprint it from Transactions; do not submit the order again.

Brave documents the [command-line launch procedure and `--kiosk-printing` flag](https://support.brave.app/hc/en-us/articles/360044860011-How-Do-I-Use-Command-Line-Flags-in-Brave). Flag behavior can vary with the installed Brave version; the printer test above is required before relying on silent printing.
