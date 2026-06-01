# JavaScript modules

The dashboard uses classic browser scripts. Keep the script order in `index.html`:
later files depend on globals declared by earlier files. `app.js` runs the final
bootstrap before the compatibility layers are applied.

## Load order

1. `adapters/supabase-adapter.js`: Supabase client adapter.
2. `core/prelude.js`: error guards, safe defaults, constants, and authentication.
3. `modules/crm.js`: CRM drawer and lead workflow base.
4. `modules/crm/search.js`: global lead search.
5. `modules/crm/home-dashboards.js`: CRM home dashboards.
6. `modules/crm/followups.js`: follow-up center.
7. `modules/crm/supabase-sync.js`: primary Supabase CRM synchronization.
8. `modules/crm/presentations.js`: lead presentation links.
9. `modules/crm/dashboard-kanban.js`: executive metrics, kanban, and CRM polish.
10. `modules/evolution.js`: Evolution API integration and lead messaging.
11. `modules/whatsapp-operations.js`: WhatsApp queue, chips, dispatch, and audit.
12. `modules/supabase-operations.js`: operational data persistence.
13. `modules/conversations.js`: conversation synchronization.
14. `core/legacy-state.js`: defaults, shared state, pagination, and date helpers.
15. `modules/assignment.js`: attribution and WhatsApp backlog actions.
16. `core/navigation-storage.js`: navigation and local storage helpers.
17. `modules/imports-validation.js`: imports, filters, and number validation.
18. `modules/legacy-dispatch.js`: link validation and routing into attribution.
19. `modules/dispatch/chip-slots.js`: per-chip batch state and send controls.
20. `modules/dispatch/chip-panels.js`: chip accordions and WhatsApp panel render.
21. `modules/dispatch/company-list.js`: company list and per-chip queue render.
22. `modules/dispatch/batch-images.js`: IndexedDB storage for batch images.
23. `modules/dispatch/queue-state.js`: queue synchronization and item actions.
24. `modules/dispatch/schedule-config.js`: automatic schedule and Evolution dispatch config.
25. `modules/dispatch/legacy-batch-send.js`: legacy single-queue batch sending.
26. `modules/instagram.js`: Instagram allocation, queue, and tracking flows.
27. `modules/tracking.js`: tracking export and the remaining tracking actions.
28. `app.js`: final bootstrap, timeline helpers, and startup checks.
29. `compatibility/sidebar-legacy.js`: guarded mobile and legacy sidebar handlers.
30. `modules/chips-compatibility.js`: chip form compatibility and Evolution config resolution.
31. `modules/whatsapp-manual-send.js`: manual WhatsApp sending compatibility layers.
32. `compatibility/queue-conversation.js`: safe queue and conversation compatibility helpers.
33. `modules/import-inbox.js`: import classification, inbox, badges, and grouped menu compatibility.
34. `modules/whatsapp-supabase.js`: authenticated WhatsApp message synchronization.
35. `compatibility/sidebar-recovery.js`: guarded legacy sidebar recovery routines.
36. `compatibility/stability-guards.js`: final queue, Instagram, and null-data guards.

When moving code between files, preserve this dependency order or replace the
shared global explicitly.
