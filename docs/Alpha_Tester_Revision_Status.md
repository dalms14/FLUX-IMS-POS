# Alpha tester revisions: CSV exports and Elite Members

These changes implement the two items selected for this revision. Implementation and automated verification do not replace a repeat evaluation by the alpha testers.

## CSV exports

- Reports → Export CSV opens a styled export window with record category, Single day, Date range, and All time controls.
- Each download contains one table with a consistent header and category-specific filename.
- Categories: sales transactions, financial summary, payment methods, product sales, refunds, cancelled checkouts, current inventory, inventory movements, system activity logs, and login activity.
- Dates initially follow the Reports page but can be changed directly inside the export window. Export/Preview loads fresh records for the selected dates, independently of the records currently displayed behind the window. Login exports also use the current search and role filters.
- Preview report shows the first five rows and the matching filename before download. Single-day filenames include the selected date, for example `flux-sales-transactions-2026-10-03.csv`. Changing a date/category clears the previous preview.
- Date queries include the full selected Philippine day(s). Exported timestamps are displayed in Philippine time (UTC+8).
- Activity and login export requests paginate through matching records so the screen's 500-row cap does not truncate the CSV.
- Current inventory is explicitly a snapshot of current stock; its filename uses the snapshot date rather than implying historical stock.
- CSV escaping and spreadsheet formula protection are retained. UTF-8 output includes a BOM for spreadsheet applications.

## Elite Member management

- The owner and accounts explicitly granted **Elite Membership** access can open **Elite Members** from the navigation. This is an independent Custom Role Access checkbox; Products access alone does not grant member management. Existing custom roles need this checkbox enabled before they can manage members.
- Before registration, the café confirms that a card was issued and the member details are correct. FLUX has no connection to an external card-issuer verification service.
- Register the member name, unique card ID (1–12 digits), status, and optional notes. Leading zeroes are preserved.
- Edit member details or set a card to inactive/reactivate it. Registration and updates create system audit records.
- Archive members from their row actions, then use **Archived members** to restore them. Archived cards are excluded from selection and checkout, remain in backups, and retain their unique card IDs. Restoring preserves the previous active/inactive status. Historical sales are unchanged.
- Records are stored in the shared `elite_members` database collection and included in owner backup exports.
- Staff search/select an active member in the POS. The server verifies the selected card and checks active status again when a sale is submitted.
- Checkout records the registry's canonical name/card details. Changing a membership record does not rewrite previous transactions.
- A card rejected at checkout returns the cashier to member selection while retaining the cart.
- Old browser-only saved member entries are not automatically approved/imported. The owner or a delegated member-management account must review and register them before they qualify for new Elite sales.

## Retest scenarios

1. Export sales, inventory, and activity logs separately. Confirm each file contains only the chosen category and the appropriate reporting dates.
2. Filter login records by name/role, then export login activity and compare the records.
3. Register a card with leading zeroes; attempt a duplicate card ID and confirm rejection.
4. Open the POS as staff and select the registered active member. Confirm that an account without Elite Membership access cannot register, edit, archive or restore cards. Grant the permission to a custom role, verify access, then revoke it and verify access is denied again.
5. Deactivate a selected card before completing checkout. Confirm the sale is rejected and the cart is retained.
6. Edit/reactivate the card, repeat checkout, and compare the saved transaction with the member details.
7. Confirm member maintenance appears in the system audit and member records are present in an owner backup.

## Account creation placement

- Create Account is available from **Users**, with a **Back to Users** link on the creation page. It is no longer a Settings section.
- The unused PIN field is removed from account creation. New accounts continue to use email and password.
- **Create Accounts** requires **Users** access. The checkbox is locked until Users is selected, and unchecking Users clears Create Accounts in both creation and access editing.
- The server removes Create Accounts from submitted roles without Users and denies account creation for existing roles that lack Users access.
- Retest: select Users and Create Accounts, uncheck Users, and save. Confirm Create Accounts is cleared and the account cannot create users through either the page or API.

The remaining alpha feedback (tablet issues, general numeric inputs, other discount behavior, receiving details, and BIR scope) is reserved for the next review. This revision does not mark those items complete.
