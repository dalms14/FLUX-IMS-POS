# Customer Ordering Process Flowchart

This is the simplified paper-ready version of the FLUX ordering process. It uses standard flowchart logic: start/end, process steps, input/output steps, decision points, and stored records.

## Flowchart

```mermaid
flowchart TD
    start([Start])
    login[Staff/Admin logs in]
    openPOS[Open Items and POS page]

    selectProduct[Select product]
    chooseOptions[Choose size, variant, add-ons, and quantity]
    addCart[Add item to cart]
    moreItems{Add more items?}
    reviewCart[Review cart]

    serviceInput[/Select service type: Dine In or Dine Out/]
    discountDecision{Apply discount?}
    discountInput[/Enter or select discount details/]
    validateDiscount[Validate discount]
    updateTotal[Update total amount]

    paymentDecision{Payment method?}
    cashInput[/Enter cash amount tendered/]
    amountEnough{Amount enough?}
    amountError[Show error and re-enter amount]
    calculateChange[Calculate change]

    gcashInput[/Enter GCash reference number and upload proof/]
    validatePayment[Validate payment details]

    confirmOrder[Confirm order with customer]
    checkInventory[(Check inventory availability)]
    stockAvailable{Stock available?}
    stockAlert[Show insufficient stock alert]
    editCart[Return to cart or edit order]

    deductStock[Deduct ingredient inventory]
    activeOrder[(Create Pending Active Order)]
    clearCart[Clear cart]

    pendingCancel{Cancel order or remove item while Pending?}
    reasonInput[/Enter cancellation or refund reason/]
    restoreStock[Restore deducted inventory]
    cancelledRecord[(Record as Cancelled/Refunded)]

    preparing[Mark order as Preparing]
    locked[Cancellation and refund locked]
    ready[Mark order as Ready]
    receipt[/Generate, view, or print receipt/]
    completed[Mark order as Completed]
    transactionRecord[(Save finalized transaction record)]
    end([End])

    start --> login --> openPOS --> selectProduct --> chooseOptions --> addCart --> moreItems
    moreItems -- Yes --> selectProduct
    moreItems -- No --> reviewCart --> serviceInput --> discountDecision

    discountDecision -- Yes --> discountInput --> validateDiscount --> updateTotal --> paymentDecision
    discountDecision -- No --> paymentDecision

    paymentDecision -- Cash --> cashInput --> amountEnough
    amountEnough -- No --> amountError --> cashInput
    amountEnough -- Yes --> calculateChange --> validatePayment

    paymentDecision -- GCash --> gcashInput --> validatePayment

    validatePayment --> confirmOrder --> checkInventory --> stockAvailable
    stockAvailable -- No --> stockAlert --> editCart --> reviewCart
    stockAvailable -- Yes --> deductStock --> activeOrder --> clearCart --> pendingCancel

    pendingCancel -- Yes --> reasonInput --> restoreStock --> cancelledRecord --> end
    pendingCancel -- No --> preparing --> locked --> ready --> receipt --> completed --> transactionRecord --> end
```

## Shape Guide

Use these symbols if you redraw the diagram in Word, Lucidchart, or diagrams.net:

| Step Type | Symbol | Examples |
| --- | --- | --- |
| Start / End | Oval / Terminator | Start, End |
| Process | Rectangle | Select product, deduct inventory, mark order as Preparing |
| Decision | Diamond | Add more items?, Apply discount?, Stock available? |
| Input / Output | Parallelogram | Enter GCash reference, print receipt, select service type |
| Stored Record / Data | Cylinder | Check inventory, Pending Active Order, Transaction History |

## Main Flow Summary

1. Staff logs in and opens the POS page.
2. Staff selects products, options, add-ons, and quantities.
3. Staff reviews the cart and selects **Dine In** or **Dine Out**.
4. Staff applies a discount if applicable.
5. Staff selects payment method: **Cash** or **GCash**.
6. The system validates payment details.
7. Staff confirms the order with the customer.
8. The system checks inventory availability.
9. If stock is insufficient, the system returns the staff to the cart.
10. If stock is available, the system deducts inventory and creates a **Pending Active Order**.
11. If the Pending order is cancelled or an item is removed, a reason is required and inventory is restored.
12. If the order proceeds, it moves through **Preparing**, **Ready**, and **Completed**.
13. Receipt is generated when the order is **Ready**.
14. The finalized transaction is saved only after the order is **Completed**.
