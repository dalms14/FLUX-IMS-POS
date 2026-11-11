# FLUX manuscript review

Reviewed: November 11, 2026 (Philippine time).

## How to read this review

I reviewed the text of all 86 PDF pages, rendered all pages to inspect their layout, and examined the embedded diagrams at their original resolution. I compared important system descriptions with the current repository and checked selected references against publishers and official publication metadata. The original PDF and application source were not changed.

**Page convention:** ordinary page references below mean the page numbers printed in the manuscript. The printed page number is seven less than the PDF viewer page number after the preliminary pages. Thus manuscript p. 23 is PDF page 30; manuscript p. 51 is PDF page 58. Preliminary pages use their printed Roman numerals.

**Finding types:**

- **Error:** a visible mistake, contradiction, or mismatch with the inspected implementation.
- **Missing:** necessary content or supporting evidence is absent from this PDF; this does not mean the activity never happened.
- **Clarify:** the wording is ambiguous, too broad, or requires confirmation from the authors/client.

This is a list of the issues found, not a guarantee that every citation, business fact, or runtime behavior has been independently verified. Browser/network errors alone were not treated as evidence that a reference is fake. Institution-specific formatting requirements should be checked against the official STI template.

## 1. Submission-blocking omissions and template material

| ID | Location | Type | Finding and correction |
|---|---|---|---|
| R001 | Abstract, p. v | Error | The abstract is still the template explanation of what an abstract should contain, including an instruction to delete the highlighted section. Replace it with the actual problem, approach, implemented system, supported evaluation results, and conclusion. Do not invent results to fill this page. |
| R002 | Literature review, p. 23 | Error | The Shopify discussion contains an accidental chatbot response beginning with a request for the full text to paraphrase. Remove that material and the unrelated first-person sentence about seeking to grow. Rebuild the paragraph from a verified source. |
| R003 | Alpha Test Results, p. 60 | Missing | The results table contains only an unfinished heading and a mostly empty row. Provide test IDs, linked requirement IDs, inputs, expected and actual results, pass/fail status, defects, and retest outcomes. |
| R004 | Testing, pp. 58-60 | Missing | Beta testing is described as completed, but there are no beta respondent counts, roles, dates, questionnaire items, response frequencies, calculated scores, or results discussion. Insert actual evidence or describe the activity as planned rather than completed. |
| R005 | Description of Prototype, p. 60 | Missing | This section has only its heading. Add screenshots and explanations of the final implemented workflows. |
| R006 | Implementation of Plan, p. 61 | Missing | The implementation plan is empty. Describe the actual deployment arrangement, configuration, initial data preparation, user training, responsibilities, and handover steps. Use the clearer heading 'Implementation Plan.' |
| R007 | Implementation of Results, p. 61 | Missing | Implementation results are empty. Describe what was actually deployed, when, to whom, issues encountered, and whether client acceptance occurred. If deployment has not occurred, state that. Use 'Implementation Results.' |
| R008 | Conclusion, p. 61 | Missing | There is no conclusion. Answer each specific objective using evidence from the results, identify limitations, and avoid claiming success that has not been demonstrated. |
| R009 | TOC pp. vi-vii; appendices pp. 67-77 | Missing | Evaluation Tool/Test Document, Sample Input/Output/Reports, and User's Guide are listed in the TOC but are not supplied as corresponding appendices. Add the promised materials or correct the TOC and appendix structure to match the submission requirements. |
| R010 | Personal technical vitae, pp. 73-77 | Error | The CVs retain 'month year,' blank experience/skills tables, and instructions about reverse chronological order. Complete relevant entries, use 'None' where appropriate, or remove unused template rows according to the school template. |
| R011 | pp. 78-79 | Error | Two trailing pages are essentially blank. The final page still has 'STI College <School Name>' in its footer. Remove unused pages and correct any remaining template footer. |
| R012 | Title, endorsement, approval, abstract | Clarify | The cover says 'Capstone Project Proposal'; the endorsement heading says 'FINAL DEFENSE' but its body recommends 'Proposal Defense'; the abstract says completion is June 2027 while the front matter says November 2026. Decide whether this is a proposal or final manuscript and make the status and dates consistent. A future completion date is not inherently wrong for a proposal, but it conflicts with presentation as a completed final study unless explained. |
| R013 | Endorsement p. ii; approval p. iii | Clarify | The Program Head appears as Richard T. Santos on one page and Richard A. Santos on another. Verify the official name and initials. Also standardize Ron Allan Salem's initials and Salvador Gascon Jr.'s punctuation against official records. |

## 2. Business context, objectives, and research evidence

| ID | Location | Type | Finding and correction |
|---|---|---|---|
| R014 | Project Context p. 2 versus transcript pp. 68-70 | Error | The context states approximately 70-100 customers every day, but the supplied interview qualifies or disputes seventy as a normal daily count and discusses roughly 30-50 receipts, seventy at the high end, and another receipt-based estimate. Replace the unsupported everyday average with verified observations, a defined period, and clearly separated receipt and customer counts. |
| R015 | Transcript pp. 68-70; statistics derived from it | Clarify | Receipts and people are treated interchangeably even though the interview says a receipt can represent multiple people. The discussion also considers thirteen operating hours but divides by eight, and applies an unexplained 20% reduction to 539 receipts. Do not alter an authentic verbatim quotation to make it correct; add an explanatory analysis and do not use these calculations as validated customer statistics. |
| R016 | Interview metadata p. 67 versus transcript p. 69 | Error | The interview is dated March 5, 2026, but the speaker discusses receipts from March 1 through March 26 'to now.' These cannot describe the same single March 5 session without another explanation. Check the recording dates and identify separate sessions if the appendix combines interviews. |
| R017 | Interview metadata p. 67; calendar p. 29; transcript p. 69 | Clarify | The location is listed as the café, the calendar describes a Google Meet interview, and an interviewer says they have not yet visited. Distinguish the interview medium, the interviewee's location, and any later site observation; do not imply an on-site visit that did not occur. |
| R018 | Transcript pp. 67-72 | Error | It is headed 'Transcript Highlight' but certified as a complete transcript. It also includes an editorial placeholder describing interviewers making more questions, while speakers are unnamed 'Speaker'/'Speaker 1.' Label it an excerpt if that is what it is, identify speakers consistently, and mark omissions rather than claiming completeness. |
| R019 | pp. 3, 34-35 versus transcript pp. 67-71 | Clarify | A synchronization delay observed in remote reports is repeatedly described as a delay before records reach 'the database.' The transcript says the local tablet continues accepting sales while remote views are unsynced. Describe the observed local-to-remote synchronization problem; the interview alone does not establish which database layer was delayed. |
| R020 | Purpose p. 4; context pp. 2-3 | Error | 'Replace the current manual ... processes' overgeneralizes a business already using Loyverse. Explain that the café uses an existing POS plus manual checks/workarounds, and identify which of those practices FLUX replaces or improves. |
| R021 | Introduction p. 1; Objective 1 p. 5 | Clarify | 'Actual usage' and 'precise quantity ... used' imply direct physical measurement. FLUX deducts expected ingredient quantities from recipe settings and sales; it does not weigh pours, measure spillage, or automatically establish physical stock accuracy. Use 'recipe-based ingredient consumption' and explain that physical discrepancies require stock-out/count-correction records. |
| R022 | Specific Objective 2, p. 5 | Error | Its title concerns real-time sales/stock monitoring, while its explanation mainly concerns POS navigation and transaction speed. Rewrite the explanation around inventory updates and monitoring, or revise the objective to match its intended measurement. 'Replacing a complex, simple system' is also contradictory. |
| R023 | Objective 3, p. 6; synthesis p. 24 | Error | The manuscript promises prediction of inventory demand, seasonal/customer purchasing patterns, and inventory optimization. The inspected forecast implementation predicts aggregate daily sales using weekday and elapsed-day features. It does not forecast per-ingredient quantities, use weather, or perform inventory optimization. Narrow these claims or identify separately implemented evidence supporting them. |
| R024 | Methodology pp. 25-26; technical background pp. 27-28; results pp. 58-60 | Missing | The forecasting method is not adequately documented. Explain the actual linear regression, target variable, seven-day horizon, minimum 42-day consecutive history, maximum 84-day window, training/validation procedure, missing-day/closed-day handling, and Philippine calendar dates. These are available in the current source. |
| R025 | Forecasting claims throughout | Missing | The manuscript does not distinguish demonstration forecasts from forecasts trained on verified café sales. The current route defaults to synthetic demonstration history; real mode is separately configured. Explicitly label the data source and do not report demonstration accuracy as evidence of real café prediction performance. This review did not inspect deployment secrets to determine whether real mode is enabled in production. |
| R026 | Objectives pp. 5-6; results pp. 58-61 | Missing | Assertions about reducing errors, waste, processing time, and stock shortages have no baseline-versus-FLUX measurements in this PDF. Define the measures and report actual observations. For forecasts, report held-out error and baseline comparison rather than assuming the more advanced label guarantees a better prediction. |

## 3. Outdated or contradictory scope and limitations

| ID | Location | Type | Finding and correction |
|---|---|---|---|
| R027 | Purpose p. 4; Owner/Admin scope pp. 7-8; analysis p. 34 | Error | These sections retain paid Pending active orders and subsequent Ready/Completed processing. They contradict FR028 and the current checkout flow. Replace the narrative with successful checkout directly saving a Completed transaction and deducting recipe ingredients. |
| R028 | Purpose p. 4; Staff scope p. 9 | Error | Receipts are still said to be printed when an order becomes Ready. Receipts are available after successful checkout. Update these descriptions and remove the obsolete Active Orders module references. |
| R029 | Sales scope p. 7 | Error | 'Cancelled/refunded pending items' is obsolete terminology. Explain that cancelled checkout records are excluded from completed sales, and applicable reports account for recorded refunds against completed paid transactions. |
| R030 | Inventory scope pp. 7-8 | Error | The scope advertises direct stock-in/adjustment operations on the Inventory module. Current stock additions go through approved purchase-order deliveries; expiry deductions are automatic when active inventory is loaded. Separate those from manual Stock Out and count-correction deductions. |
| R031 | Purchase Order scope pp. 7-8; supplier limitation p. 10 | Clarify | Saying stock updates 'once items are received' omits the arrival-report and approval gate. State that the receiver reports arrival first and stock increases only after eligible delivery approval. |
| R032 | Scope pp. 6-9; analysis p. 33; use-case explanation p. 56 | Error | These descriptions mainly use Owner/Admin/Staff and omit Custom Role accounts, despite FR008-FR014 and the context DFD. Add Custom Role, with Finance and HR treated as custom job roles, and explain permission-dependent access. |
| R033 | Admin Settings scope pp. 8-9 versus FR015/FR090 | Error | Admin access to 'system & backups' can imply backup export permission. Distinguish viewing permitted settings from the Owner-only password-confirmed export function. |
| R034 | Limitations p. 11 versus Elite scope p. 7 and FR075-FR082 | Error | 'No Customer Loyalty Program' says membership tracking is excluded, while Elite Membership Management is implemented and specified. Limit the exclusion to points/reward accumulation or other genuinely absent loyalty functions; retain membership registration, status checking, and discount eligibility in scope. |
| R035 | Limitations p. 11; Forgot Password p. 53; context DFD p. 50 | Clarify | The email-notification limitation needs an explicit authentication exception. Routine low-stock/report/receipt emails may be excluded, but password recovery sends verification email. Explain that in-system purchase-order notifications also exist; do not imply that all notifications are absent. |
| R036 | Limitations p. 11 | Error | The heading 'No Multi-Currency Support' is followed by text about fingerprint, facial recognition, and biometrics. Write a currency limitation under that heading or rename it 'No Biometric Authentication.' |
| R037 | Hardware limitation p. 10; testing claim p. 58 | Clarify | 'Receipt' is used where 'receipt printer' is intended. Distinguish browser printing from direct hardware integration. The testing section must not imply verified dedicated printer integration unless the device, configuration, and test results are documented. |
| R038 | Staff Interface p. 9 | Error | The Staff profile bullet says 'Enables admin.' Change it to staff/the logged-in user. Treat the branding/name item as presentation detail rather than a major system capability. |
| R039 | Device compatibility p. 6 versus deployment analysis p. 34 | Error | Scope supports phones/tablets/laptops/desktops, but the deployment description restricts cashier/inventory access to desktops. State the actual supported devices and distinguish development equipment from café terminals. |
| R040 | Deployment analysis p. 34; architecture pp. 48-49 | Clarify | 'Within only the store's premises' is presented as a restriction without explaining network enforcement, while a cloud database is described. State the intended deployment and allowed access locations. A cloud database alone neither proves unrestricted access nor proves a premises-only restriction. |

## 4. Requirements corrections and missing precision

Some of the wording below originated in requirements I supplied earlier. These are corrections to that wording; they do not require rebuilding the system.

| ID | Location | Type | Finding and correction |
|---|---|---|---|
| R041 | Requirements headings pp. 38-44 | Error | '1.5' is missing: Product and Recipe Management and Inventory Management are both 1.6. Activity Logs and Notifications and User Account Management are both 1.10. Use 1.5 Product and Recipe Management and 1.11 User Account Management. The FR001-FR103 identifiers themselves are continuous. |
| R042 | pp. 35, 38, 41 | Error | 'Authentication and Account process' should be 'Authentication and Account Access'; 'Refune Processing' should be 'Refund Processing'; remove the inconsistent trailing period from the Purchase Orders heading. |
| R043 | FR025, p. 37 | Clarify | The sentence can mean that both reference and proof are required only on mobile. Correct it to: 'For every GCash payment, the system shall require a reference number. On supported mobile checkout screens, it shall also require payment proof.' The current proof requirement is based on the mobile viewport; this is not automatic verification by GCash. |
| R044 | FR052, p. 40 | Clarify | Zero stock also satisfies 'at or below the low-stock threshold,' so categories overlap. Specify: out of stock = zero; low stock = greater than zero and at or below the threshold; sufficient stock = above the threshold. |
| R045 | FR053-FR054, p. 40 | Clarify | Specify whether the near-expiry window includes today and exactly seven days ahead, and define expiry using the system's calendar-date convention. Automatic expiry deduction occurs when active records are fetched, not necessarily in a continuously running background job. FR054 already captures the fetch trigger; retain that precision elsewhere. |
| R046 | FR040, FR062, FR068, FR075 | Clarify | These lists can be read as requiring every listed field. Distinguish required and optional fields: for example, EliteMember email defaults to empty, purchase-order expected delivery date can be absent, unit cost defaults to zero, and receipt expiry can be absent. Do not claim the interface requires an optional field without checking its validation. |
| R047 | FR010-FR014, FR063-FR071, account requirements | Missing | 'Authorized' and 'eligible' are not fully defined. Add a compact role/action matrix and receiver-selection rules. Keep purchase-order approval separate from delivery approval; Admin is not automatically a delivery approver merely because it is Admin. Include exceptions such as the Owner account being protected from inappropriate account operations. |
| R048 | Authentication/account sections pp. 35-36, 44; login diagram p. 52 | Missing | Current code supports editable workdays/shift times and optional off-shift login restrictions for Staff/Custom accounts; Owner/Admin are exempt. These behaviors are absent from the requirements and flowchart. If they are part of the submitted build, document them and their Philippine-time/grace-window rules. |
| R049 | FR087-FR088, p. 43 | Missing | Forecast requirements omit the forecast target, horizon, minimum history, demo/real distinction, and unavailable-history states. Add acceptance criteria matching the actual forecasting implementation. Sales forecasts are not automatically ingredient-demand forecasts. |
| R050 | FR090-FR091, p. 43; backup statements elsewhere | Clarify | 'System backup' can imply a complete recoverable database backup. The current export contains nine collections: products, categories, add-ons, discounts, inventory, transactions, refunds, recipes, and Elite Members. It excludes user accounts, purchase orders, notifications, session/security records, audit/login records, waste, and forecast snapshots. Inventory batches are included inside inventory documents. Call it a selected business-data export unless a full backup/restore process is separately implemented and verified. |
| R051 | NFR016-NFR018, p. 46 | Missing | This 'Performance' section describes processing indicators, refresh behavior, and duplicate-submission handling, but provides no measurable response-time or capacity criteria. Define agreed, testable targets with a workload, device, network, and measurement method. Do not invent arbitrary milliseconds and claim they were achieved. |
| R052 | NFR005-NFR007, p. 45 | Missing | 'Supported modern browsers,' readable text, and supported screen sizes are not defined. List the browsers/devices/viewports actually tested. Responsive layout alone is not evidence of accessibility compliance; include the accessibility checks the project actually intends to evaluate. |
| R053 | FR092 and NFR claims, pp. 43-47 | Clarify | FR092 broadly refers to blocked logins. The inspected activity schema distinguishes successful login/logout and archived/off-shift blocks; it does not establish that every wrong password or rate-limit event becomes a LoginActivity entry. State the logged events explicitly. Requirements about security/data integrity also need test evidence rather than being presented as proof of compliance. |
| R054 | FR/NFR lists and results pp. 35-47, 58-60 | Missing | There is no requirements-to-tests traceability table. Map each requirement to its module, test case, actual result, and status; separate proposed behavior from verified implementation. Some repeated validation rules can be cross-referenced rather than counted as independent completed features. |

## 5. DFD and process diagrams

| ID | Location | Type | Finding and correction |
|---|---|---|---|
| R055 | Level 1 DFD, p. 51 | Missing | The exported detailed DFD stops at 5.0. Processes 6.0 Reports/Forecast/Backups, 7.0 Purchase Orders/Deliveries, 8.0 Refunds, and 9.0 Elite Membership, together with their stores and flows, are absent. Insert the sections already created; do not rebuild 1.0-5.0 solely because the export is incomplete. |
| R056 | Context DFD p. 50 versus Level 1 DFD p. 51 | Error | Custom Role is present at context level but missing from the Level 1 export. Its authentication and other permitted interactions must appear in the detailed sections so the levels account for the same external information exchanges. |
| R057 | D1 and 1.0, p. 51 | Error | The arrow labeled 'Updated account, verification, and session records' points from D1 toward 1.0. For saving updates, reverse it: 1.0 -> D1. Keep the separate D1 -> 1.0 flow for reading account/session details. |
| R058 | 5.0 and user entities, p. 51 | Error | Product/recipe management arrows reuse 'Inventory requests' and 'Stock status and results.' Use catalog/recipe requests or changes going into 5.0, and catalog details/update results going out. The 5.0 -> D8 catalog activity direction is appropriate. |
| R059 | 4.0/5.0 and Staff/Cashier, p. 51 | Clarify | Arrows can imply all cashiers may manage stock/catalog records. Describe them as permission-dependent interactions and represent the Custom Role actor as appropriate. Do not add broad permissions merely to justify a diagram line. |
| R060 | Login caption/explanation, p. 52 | Error | The caption says Staff and Admin only, but authentication covers all account roles. The prose says every success goes to the dashboard, while the diagram correctly says the first permitted page and shows forced first-login password changes. Update the caption and explanation to reflect the diagram. |
| R061 | Forgot Password explanation, p. 53 | Error | The explanation is grammatically broken and uses 'reset password' where the pictured button says 'Update Password.' Describe the sequence clearly: request code -> enter code/new/confirm password -> validate -> update password and invalidate sessions -> return to login. The existing diagram does not need wholesale replacement. |
| R062 | POS diagram and explanation, p. 54 | Error | The explanation claims order-status updates and cancellation/refund handling, but the diagram shows the completed-sale path and no cancellation/refund branch. Remove unsupported claims from the caption/prose or provide separate cancellation/refund diagrams. The successful checkout path is broadly consistent with the updated requirements. |
| R063 | Inventory diagram, p. 55 | Error | The delivery branch contains 'Approved Delivery' before the Owner/Finance/HR reviews and approves it. Rename that earlier step to 'Open Pending Delivery' or 'Select Reported Arrival.' Approval must remain after review and validation. |
| R064 | Inventory diagram, p. 55 | Clarify | 'Approve Draft' appears before 'Owner/Admin Reviews Purchase Order.' If it is navigation to an approval screen, label it 'Open Draft for Review'; if it is the approval action, put it after review. Its current name suggests approval has already happened before the approval decision. |
| R065 | Inventory diagram explanation, p. 55 | Error | The text describes generic adding/approving/stocking-in by Owner or Admin, but the actual diagram includes receiver reporting and Owner/Finance/HR delivery approval. Update the explanation rather than advertising unsupported direct Inventory-page additions. |
| R066 | Login diagram p. 52; current build | Missing | Add the off-shift decision if shift restrictions are within the final build's scope. Also explain that digital completion of a paid transaction does not mean the drink has physically finished preparation; this avoids reintroducing the removed kitchen-status workflow. |

## 6. Use-case diagram and ERD

| ID | Location | Type | Finding and correction |
|---|---|---|---|
| R067 | Use-case diagram, p. 56 | Error | This PDF contains an older diagram with only Owner/Admin/Staff. The later version with Custom Role is not included. Replace the embedded image with the latest version and update its explanation. |
| R068 | Use-case diagram, p. 56 | Error | Many actor arrows end at a module rectangle or the outer system boundary instead of a use-case oval. 'Full Access' pointing at the boundary does not identify individual use-case participation. Connect actors to relevant ovals, or use clearly defined actor generalization/shared actors to reduce lines. Use ordinary solid association lines; the dashed Admin arrows have no defined include/extend meaning. |
| R069 | Use-case diagram, p. 56 | Error | Staff has a visible association to 'View Finance Reports,' while central POS use cases such as Process Sale and Record Cash/GCash Payment lack clear direct associations. Check each actor/action against the intended permission matrix instead of connecting nearby shapes for convenience. Finance-report access is not automatically a default cashier permission. |
| R070 | Use-case diagram, p. 56 | Error | The Owner-only restrictions are not clearly represented: Assign User Permission and Export System Backup should not appear available merely because an Admin arrow reaches their module. Associate Owner with those use cases explicitly and label any permission-dependent access accurately. |
| R071 | Use-case diagram, p. 56 | Error | Admin still carries the copied label 'Cashier workflow.' Replace it with a meaningful role label or remove the copied subtitle. Clean crossed lines and actor labels that overlap annotations. |
| R072 | ERD caption and figure, p. 57 | Clarify | The figure mixes MongoDB collections and embedded structures with SQL-style PK/FK aliases. This can be used as a logical data model, but should not be presented as an exact physical MongoDB schema. Call it a logical ERD and state what the embedded markers and logical references mean in the explanatory paragraph. MongoDB is not itself an error requiring conversion to SQL. |
| R073 | ERD embedded boxes, p. 57 | Clarify | TransactionItem and RecipeIngredient are marked embedded yet show standalone PK/parent-FK field names that are not stored under those literal names in the current arrays. Explain that they are logical aliases, or align the figure with actual embedded `_id` values and containment. Do not add fictitious foreign-key fields to production just to match the drawing. |
| R074 | ERD Product-Recipe relationship, p. 57 | Clarify | The application edits a product's recipe as a single recipe, while the relationship appears to permit many recipes and the schema does not enforce a unique productId. Decide whether the drawing represents intended business cardinality or current database constraints. Document that distinction rather than automatically changing both the model and source. |
| R075 | ERD, p. 57 | Missing | ForecastSnapshot is not represented despite FR088 and D10 in the planned complete DFD. AuthSession, SecurityAttempt, and EmailVerification are also omitted. An intentionally scoped main ERD can omit support collections, but the caption must identify that scope; provide a supplementary schema/data dictionary if the document claims complete database coverage. |
| R076 | ERD User-PurchaseOrder line, p. 57 | Clarify | The line is not clearly labeled as the optional `assignedReceiver.userId` reference to `User._id`. Distinguish that from the separate business staff code `User.userId`, and from name/email snapshots such as approvedBy/createdBy. Standalone snapshot-based collections do not need invented foreign-key lines. |
| R077 | pp. 51, 55-57 | Error | The DFD, inventory flowchart, use-case diagram, and ERD are too dense at their embedded page size for comfortable reading in the exported manuscript. The ERD is especially small. Use landscape/full-page layouts or split large diagrams across labeled continuation pages while preserving connector identities. Re-export sharp diagrams; enlarging a small screenshot alone will not recover detail. |
| R078 | Architecture diagram p. 48 versus text p. 49 | Error | The diagram says 'ORM Queries and Responses' although the text correctly describes Mongoose ODM. Change that label to 'Mongoose/ODM Queries and Responses.' Correct 'DATA BASE LAYER,' 'What user Interact With,' 'Processes Request,' and 'Stores and Manage.' |

## 7. Methodology, scheduling, equipment, and evaluation

| ID | Location | Type | Finding and correction |
|---|---|---|---|
| R079 | Agile discussion, pp. 25-26 | Missing | The description is mostly generic and shifts between past/future tense. Provide evidence of the actual iterations: sprint dates, features completed, reviews, stakeholder feedback, defects, and changes. Separate the software development method from research data collection and evaluation methods. |
| R080 | Agile figure p. 25; Gantt p. 31 | Error | Both are labeled Figure 1 in different styles. Use unique sequential figure numbering and update every in-text reference and list of figures. |
| R081 | Calendar pp. 28-30 versus Gantt p. 31 | Error | One schedule describes 21 weeks, while another spans January-December without years. Completion is elsewhere listed as June 2027, while final defense/deployment are placed around November/December in the chart. Align them to a single dated project timeline, and identify planned versus actual completion. |
| R082 | Gantt chart p. 31 | Error | The chart is rotated and difficult to read at the printed size; its legend/layout is also cramped. Present it in readable landscape orientation with a year and consistent status colors. |
| R083 | Resources p. 32 | Error | A developer gaming laptop configuration with an RTX 3050 is called the minimum hardware requirement. No evidence establishes that this GPU is required for browser-based café use or the server's JavaScript regression. Relabel it as development hardware and separately document tested client/server requirements without inventing an untested minimum. |
| R084 | Resources p. 32 | Clarify | The software list mixes end-user runtime requirements with development/documentation tools. Separate browser/client requirements, backend/database/deployment requirements, and developer tools. Windows 11/VS Code/Figma/GitHub/Word are not all required on every café terminal. |
| R085 | Requirements analysis p. 33 | Error | Staff tasks include 'attendance logging,' but the current described module records login/session activity and shift restrictions, not a demonstrated attendance/payroll system. Remove the claim or define and demonstrate a separate attendance feature. |
| R086 | Testing pp. 58-59 | Missing | The paper says the system met standards and ran without crashes, but does not provide test build/version, environment, case counts, pass counts, defects, retests, timing measurements, or reproducible outputs. Qualify those assertions until evidence is inserted. This review did not rerun the application test suite or certify production behavior. |
| R087 | ISO evaluation pp. 58-59 | Error | The first description lists six loosely named characteristics, while the next lists seven using different terminology. ISO/IEC 25010:2023 defines nine product-quality characteristics. Selecting seven can be defensible, but explicitly identify the selected subset, justify omissions, and use consistent official names; do not claim the model itself contains only seven. Cite the standard in References. |
| R088 | Evaluation pp. 58-60 | Missing | There is no explanation of how questionnaire items map to selected quality characteristics or how technical alpha tests differ from user beta ratings. Satisfaction ratings alone cannot establish server permission enforcement, concurrency safety, correct accounting, or prediction accuracy. Provide objective cases/measurements for those claims. |
| R089 | Likert analysis p. 59 | Missing | The four interpretation ranges are provided, but the response coding, calculation procedure, rounding policy, respondents, and actual scores are absent. Explain how means are computed and interpreted. The range table itself is not a test result. |
| R090 | Objectives and conclusion/results | Missing | There is no evidence trail showing which objective was achieved by which test/result. Use an objective-to-evidence table and distinguish implemented capability, demonstrated result, and anticipated business benefit. |

## 8. Reference and literature-review problems

The following corrections were checked against primary publisher pages, official proceedings, or publication metadata where available. An inaccessible URL is listed as unverified rather than automatically called fabricated.

| ID | Location | Type | Finding and correction |
|---|---|---|---|
| R091 | Point-of-sale loyalty study, p. 22; References p. 63 | Error | The text attributes the paper to Chahua and López (2025). The linked publisher article identifies María Victoria Hermenegildo-Chávez, David Martín-Ruiz, and Francisco Javier Rondán-Cataluña, published in 2023, volume 25(4). Correct both the in-text citation and reference. [Publisher article](https://www.scielo.br/j/rbgn/a/pgNWfjjk8wsyvfzjPq3bJYx/?lang=en). |
| R092 | System Quality study, pp. 20-21; References p. 66 | Error | Santos, Villanueva, and Ramos do not match the authors of the cited DOI. Official Crossref metadata identifies Eunice Anne E. Natividad, Andrei Marie M. Musngi, Rigel B. Molinyawe, Eloisa A. Rivera, Ramachandra C. Torres, and Donn Enrique L. Moreno; 2024 proceedings, pp. 123-129. Correct attribution and check that the location/sample/framework claims match the actual paper. [Publication DOI](https://doi.org/10.1145/3691422.3691480). |
| R093 | Cloud-based POS characteristics, pp. 21-22; References p. 66 | Error | The cited publisher page lists Kosol Jitvirat, Kandhicha Charoenvaichat, and Thanathon Chongsirithitisak, not Thongnoppakun and Kulsrisombat. Use the publisher's citation metadata: 2024, 18(2), 121-138. [Publisher article](https://so03.tci-thaijo.org/index.php/trujournal/article/view/273933). |
| R094 | Ferrater-Gimena inventory analysis, p. 12; References p. 63 | Error | The reference omits Sy and gives volume 33, pp. 2470-2487. The linked journal record lists Ferrater-Gimena, Sayson, and Sy, volume 34, pp. 384-399 (2023). Also use the title's 'System Dynamics' rather than 'System Dynamic.' [Journal record](https://namibian-studies.com/index.php/JNS/article/view/1715). |
| R095 | Gupta/Tiwari/Galkin reference, p. 63 | Error | DOI 10.3390/logistics4040031 resolves to 'A Simulation-Based Planning Tool for Floating Storage and Regasification Units' by Papaleonidas, Androulakis, and Lyridis, not the claimed IoT/perishable-inventory article. Locate the intended source or remove this mismatched reference. [Actual DOI target](https://doi.org/10.3390/logistics4040031). |
| R096 | Coffee inventory application, p. 15; References pp. 62-63 | Error | The reference points to article /334, but the official metadata for the named Alifadillah/Supriatna article identifies DOI 10.55208/bistek.v16i2.482 and publisher article /482. Replace the mismatched link and copy the complete publisher bibliographic information. [Publication DOI](https://doi.org/10.55208/bistek.v16i2.482). |
| R097 | Coffee Shalter study, pp. 17-18; References p. 65 | Error | The body says 2024 and the reference says 2022. The located official iCiETVET 2025 proceedings contain the paper by Nopita Sari Br Tarigan and Guidio Leonarde Ginting, pp. 224-230. Verify the version actually used and align year and author list; do not choose one of the conflicting years arbitrarily. [Official proceedings](https://cietvet.ptsb.edu.my/dokumen/E_PROCEEDING_ICIETVET_2025.pdf). |
| R098 | Purchase-order article p. 23; References p. 66 | Error | The body uses Stawan (2022), but References gives October 23, 2023. The source says October 23, 2022. [Original article](https://factwise.io/blog/post/purchase-orders-inventory-management). |
| R099 | Tabuk SME study, pp. 13-14; References pp. 62-66 | Missing | Mariani and Wacas are discussed but the study has no corresponding reference entry. Add the verified author list, publication year, title, journal, volume/issue, pages, and DOI/source. |
| R100 | Several RRL paragraphs pp. 13-17 | Clarify | Much of the review evaluates how well an 'abstract' is written rather than explaining findings, methods, limitations, and relevance to FLUX. Critical appraisal is valid when evidence-based, but verify the full paper before repeating contradictions or inferred findings. Remove generic compliments and unsupported criticism. |
| R101 | AI demand study p. 21; References p. 63 | Missing | The Fatma Ballıkaya entry repeats the title and lacks a usable publication venue/DOI/URL. I could not independently verify the exact publication from the available details. Obtain the original document and verify author, year, venue, and claims before retaining it. This is unverified, not a finding that it is necessarily nonexistent. |
| R102 | References pp. 63-66 | Error | Some entries use only a first/last subset of a longer author list, remove names listed in the body, or include credentials in author names. Examples include Bustillo/Ramirez, Manurung/Simanullang/Munthe, Canlas et al., and Boado et al. Copy author order and names from each original publication; do not reconstruct surnames from prose. |
| R103 | Introduction p. 1; Jaboob reference p. 64 | Error | The publisher lists four authors, including Al Montaser Mohammed, while the reference lists only three and has inaccurate initials. Add the full author list and chapter/editor/DOI details. [Publisher record](https://doi.org/10.4018/979-8-3693-1846-1.ch004). |
| R104 | Bautista reference p. 64; Shopify reference p. 66 | Error | Bautista points to a truncated researcher profile instead of the specific paper; Shopify points only to its homepage. Supply a source-specific retrievable reference with the correct title and date. Do not invent a Shopify article title to fit a general website. |
| R105 | Canlas, Ferrater-Gimena roadmap, and other dates | Clarify | The Canlas URL includes a 2019 collection name despite the cited 2022 date. The roadmap entry's upload date and claimed publication year also need checking against the original journal, not just repository upload information. Neither a URL filename nor an upload date alone proves the publication year. |
| R106 | References pp. 62-66; ISO discussion pp. 58-59 | Missing | Gupta and Muhammad Ainul Fahmi are listed without clear corresponding discussion/citations in the manuscript text, while ISO/IEC 25010:2023 is used but not listed. Audit both directions: every cited work needs an entry, and every retained reference should be cited for a relevant claim. |
| R107 | References throughout | Error | Reference formatting is inconsistent and incomplete: given names versus surnames/initials, inconsistent years, missing venue/volume/issue/pages, inconsistent title capitalization, duplicate title text, credentials in author lists, and bare links. Format all entries using the school's prescribed citation style and hanging indents after source verification. |
| R108 | RRL organization pp. 12-24 | Clarify | Empirical studies are also placed under 'Literature,' so the four headings do not have a clear classification rule. Follow STI's required categories consistently, add a brief relevance/limitation statement for each source, and make the synthesis identify FLUX's specific contribution without claiming that it has every technology mentioned in related works. |

## 9. Navigation, numbering, layout, and language

| ID | Location | Type | Finding and correction |
|---|---|---|---|
| R109 | TOC, pp. vi-vii | Error | Page numbers are stale. Examples: RRL is listed at 9 but begins at 12; Methodology is listed at 22 but begins at 25; Requirements Documentation is listed at 31 but begins at 35; Design is listed at 36 but begins at 48; Results is listed at 45 but begins at 58. Regenerate the TOC after final layout. |
| R110 | TOC versus preliminary pages | Error | The TOC lists List of Figures, List of Tables, and List of Appendices, but those lists are not present as the listed preliminary pages. The actual p. vii is the continuation of the TOC. Insert the required lists and regenerate all Roman-numeral references. |
| R111 | Figure captions and references | Error | Figure 1.0, Figure 1, Figure 3, Figure 4.0, Figure 6.1, and other forms are mixed. The duplicate Figure 1 also leaves the sequence misleading. Adopt a single unique numbering convention and update in-text references, lists, and continuation captions. |
| R112 | TOC p. vi | Error | Green/yellow editing highlights remain. Remove draft-only highlighting unless it is explicitly required for adviser review. |
| R113 | pp. 49, 51, 56, 60-62, 72-77 | Error | Several headings are stranded at the bottom or separated from their content; References starts low on an almost empty p. 62; CV content spills awkwardly into the next person's page. Use deliberate section/page breaks and 'keep with next' rather than blank paragraphs. The stray 'l' above the use-case caption on p. 56 should be removed. |
| R114 | Technology/calendar tables pp. 27-30; diagram pages | Clarify | Tables continue across pages without consistently repeated headers/continuation labels. Repeat table headers where supported and keep captions attached. Large diagrams need readable layouts rather than simply more surrounding whitespace. |
| R115 | Purpose p. 4; technical background p. 27; context p. 3 | Error | There are incomplete phrases: 'by providing more reliable, and user-friendly'; 'proposed FLUX Development a'; and the stray ending 'The data.' Complete or remove these fragments. |
| R116 | RRL pp. 15, 18, 22-23 | Error | Visible editing/grammar errors include 'assisted users. improve,' 'consumption. trends,' 'centralized. databases,' 'thes systems,' and merged words such as 'shopoperations,' 'perceptionsand,' and 'valueof.' Correct them after checking the original meaning. |
| R117 | Throughout | Clarify | Tense, naming, and capitalization vary: proposed versus developed, Eli/ELI, café/cafe, POS/PoS, Point of Sale/Point-of-Sale, 'the staffs,' 'monitor stocking,' and 'receipt of generation.' Use one formal system name and consistent role/module terms; choose tense by whether the activity is planned or actually completed. |

## 10. Suggested replacement passages for the largest contradictions

### Checkout description

After the user confirms payment, FLUX validates the current product prices, selected options, and ingredient availability. A successful checkout deducts the recipe-based ingredient quantities and saves the sale as a Completed transaction. The user can then view or print the receipt. Cancelling checkout before confirmation records a cancelled transaction without deducting inventory. Authorized users can process eligible refunds against Completed paid transactions; refunds do not automatically restore ingredient stock.

### Inventory and receiving description

FLUX displays ingredient stock, low-stock indicators, and batch expiration information. Authorized users can record Stock Out transactions and archive ingredients with zero stock. New stock is recorded through purchase orders: an eligible receiver reports the delivered quantities, and inventory increases only after the Owner or an authorized user with a Finance or HR job role approves the delivery.

### Membership limitation

The system supports registration and status management of issued Elite Membership cards and verification of eligible membership discounts. It does not provide a points-accumulation or rewards-redemption program.

### Email limitation

The system sends email verification codes for account recovery. Routine low-stock, receipt, and report notifications are not sent through email or SMS. Purchase-order events use in-system notifications.

### Forecasting description

FLUX generates a seven-day daily sales forecast using linear regression with weekday and sales-trend features. Demonstration forecasts use synthetic history and are identified separately from forecasts based on verified café sales. Real-sales forecasting requires sufficient consecutive completed-day records. Forecast error is evaluated against held-out observations and a weekday-average baseline. The current implementation does not directly predict ingredient-level demand or automatically optimize purchase orders.

### Diagram descriptions

- **Login:** describe all roles, archived-account checks, first-login password replacement, lockout, optional shift restrictions, session creation, and the first permitted page. Do not say all roles always land on Dashboard.
- **POS:** describe the pictured completed-sale flow; put refund/cancellation behavior in its own diagram if it is not actually shown.
- **Inventory:** explain purchase orders and delivery approval, not generic direct stock additions on the Inventory page.
- **ERD:** call it a logical MongoDB data model and explain embedded structures and logical references in the accompanying paragraph. This does not require cluttering the drawing with notes.

## 11. What to fix first

1. Replace the abstract template and remove the accidental chatbot response.
2. Establish whether this is the proposal or final manuscript, and reconcile dates and officials' names.
3. Correct the major source attributions and wrong DOI; verify untraceable sources before paraphrasing them again.
4. Replace obsolete Pending/Preparing/Ready descriptions and fix the scope/limitations contradictions.
5. Insert the missing DFD sections and latest use-case export, then correct the specific arrows/labels identified above.
6. Complete real test results, forecast evaluation, prototype, implementation sections, conclusion, and missing appendices.
7. Resolve the requirements ambiguities and document final-build shift behavior.
8. Regenerate the TOC/lists, repair numbering, enlarge diagrams, remove placeholders, and proofread the final export.

## 12. Implementation evidence used

These paths identify the code checked for this review. They are evidence for the current source behavior, not proof that every code path was exercised in a running production system.

- `backend/services/salesForecast.js`: forecast window, target, features, demonstration data, horizon, baseline validation metadata.
- `backend/services/linearSalesModel.js`: ordinary least-squares trend/weekday model and held-out baseline evaluation.
- `backend/routes/salesForecastRoutes.js`: demo/real selection, verified-history configuration, closure handling, missing-history outcomes.
- `backend/services/backupExport.js`: actual nine-collection export scope.
- `backend/routes/authRoutes.js`: login/first-login/reset flow, shift editing, account permissions, archive/restore, password confirmation.
- `backend/utils/permissions.js`: permission gates and custom Finance/HR access.
- `backend/routes/purchaseOrderRoutes.js` and `backend/models/PurchaseOrder.js`: receiver selection, approval roles, pending arrivals, approved inventory changes, optional fields.
- `frontend/src/pages/Items.jsx`: GCash reference and mobile proof behavior.
- `backend/models/EliteMember.js`: optional email and member validation/status fields.
- `backend/models/User.js`, `LoginActivity.js`, `Recipe.js`, `Transaction.js`, and `Waste.js`: identifiers, references, embedded records, schedule fields, and logging event scope.

## 13. External verification sources

- [ISO's official ISO/IEC 25010:2023 page](https://www.iso.org/standard/78176.html): the product-quality model has nine characteristics; choosing an evaluation subset requires clear scope.
- [Lucid's DFD notation guidance](https://lucid.co/diagram/dfd/symbols-and-notation): Gane-Sarson rounded processes and open-ended stores, and context-to-detailed decomposition.
- [Point-of-sale loyalty publisher article](https://www.scielo.br/j/rbgn/a/pgNWfjjk8wsyvfzjPq3bJYx/?lang=en): actual authors and 2023 publication.
- [Cloud-based POS characteristics publisher article](https://so03.tci-thaijo.org/index.php/trujournal/article/view/273933): actual authors, 2024 date, 18(2), 121-138.
- [Inventory dynamics journal record](https://namibian-studies.com/index.php/JNS/article/view/1715): authors, volume 34, 384-399.
- [System Quality paper DOI](https://doi.org/10.1145/3691422.3691480) and [official Crossref metadata](https://api.crossref.org/works/10.1145/3691422.3691480): actual six authors and proceedings details.
- [Actual Logistics DOI target](https://doi.org/10.3390/logistics4040031): floating storage/regasification study, not the cited IoT inventory article.
- [Coffee inventory application DOI](https://doi.org/10.55208/bistek.v16i2.482): official publisher record points to article 482.
- [Official iCiETVET 2025 proceedings](https://cietvet.ptsb.edu.my/dokumen/E_PROCEEDING_ICIETVET_2025.pdf): Coffee Shalter paper, pp. 224-230, Tarigan and Ginting.
- [Original FactWise article](https://factwise.io/blog/post/purchase-orders-inventory-management): Stawan, October 23, 2022.
- [Jaboob chapter publisher record](https://doi.org/10.4018/979-8-3693-1846-1.ch004): four authors and chapter publication details.

The PDF is not ready as a completed final manuscript in its present form. The largest remaining work is completing evidence and reconciling versions; the findings do not mean the entire application or every diagram needs to be rebuilt.
