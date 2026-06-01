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
12. `modules/legacy-dispatch.js`: legacy chip dispatch and scheduling flows.
13. `modules/instagram.js`: Instagram allocation, queue, and tracking flows.
14. `modules/tracking.js`: tracking export and the remaining tracking actions.
15. `app.js`: final bootstrap, timeline helpers, and startup checks.
16. `compatibility/sidebar-legacy.js`: guarded mobile and legacy sidebar handlers.
17. `modules/chips-compatibility.js`: chip form compatibility and Evolution config resolution.
18. `modules/whatsapp-manual-send.js`: manual WhatsApp sending compatibility layers.
19. `compatibility/queue-conversation.js`: safe queue and conversation compatibility helpers.
20. `modules/import-inbox.js`: import classification, inbox, badges, and grouped menu compatibility.
21. `modules/whatsapp-supabase.js`: authenticated WhatsApp message synchronization.
22. `compatibility/sidebar-recovery.js`: guarded legacy sidebar recovery routines.
23. `compatibility/stability-guards.js`: final queue, Instagram, and null-data guards.

When moving code between files, preserve this dependency order or replace the
shared global explicitly.
