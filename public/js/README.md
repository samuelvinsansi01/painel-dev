# JavaScript modules

The dashboard uses classic browser scripts. Keep the script order in `index.html`:
later files depend on globals declared by earlier files. `app.js` runs the final
bootstrap before the compatibility layers are applied.

## Load order

1. `adapters/supabase-adapter.js`: Supabase client adapter.
2. `core/prelude.js`: error guards, safe defaults, constants, and authentication.
3. `modules/crm.js`: CRM drawer, search, dashboards, follow-ups, and kanban.
4. `modules/evolution.js`: Evolution API integration and lead messaging.
5. `modules/whatsapp-operations.js`: WhatsApp queue, chips, dispatch, and audit.
6. `modules/supabase-operations.js`: operational data persistence.
7. `modules/conversations.js`: conversation synchronization.
8. `core/legacy-state.js`: defaults, shared state, pagination, and date helpers.
9. `modules/assignment.js`: attribution and WhatsApp backlog actions.
10. `core/navigation-storage.js`: navigation and local storage helpers.
11. `modules/imports-validation.js`: imports, filters, and number validation.
12. `modules/legacy-dispatch.js`: link validation and routing into attribution.
13. `modules/dispatch/chip-slots.js`: per-chip batch state and send controls.
14. `modules/dispatch/chip-panels.js`: chip accordions and WhatsApp panel render.
15. `modules/dispatch/company-list.js`: company list and per-chip queue render.
16. `modules/dispatch/batch-images.js`: IndexedDB storage for batch images.
17. `modules/dispatch/queue-state.js`: queue synchronization and item actions.
18. `modules/dispatch/schedule-config.js`: automatic schedule and Evolution dispatch config.
19. `modules/dispatch/legacy-batch-send.js`: legacy single-queue batch sending.
20. `modules/instagram.js`: Instagram allocation, queue, and tracking flows.
21. `modules/tracking.js`: tracking export and the remaining tracking actions.
22. `app.js`: final bootstrap, timeline helpers, and startup checks.
23. `compatibility/sidebar-legacy.js`: guarded mobile and legacy sidebar handlers.
24. `modules/chips-compatibility.js`: chip form compatibility and Evolution config resolution.
25. `modules/whatsapp-manual-send.js`: manual WhatsApp sending compatibility layers.
26. `compatibility/queue-conversation.js`: safe queue and conversation compatibility helpers.
27. `modules/import-inbox.js`: import classification, inbox, badges, and grouped menu compatibility.
28. `modules/whatsapp-supabase.js`: authenticated WhatsApp message synchronization.
29. `compatibility/sidebar-recovery.js`: guarded legacy sidebar recovery routines.
30. `compatibility/stability-guards.js`: final queue, Instagram, and null-data guards.

When moving code between files, preserve this dependency order or replace the
shared global explicitly.
