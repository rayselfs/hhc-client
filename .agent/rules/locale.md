# Internationalization (i18n) Rules

## General Principles

1.  **Always use i18n**: Never hardcode strings in the UI. All user-facing text must be in `src/locales/*.json`.
2.  **Naming Convention**: Use `lowerCamelCase` for keys.
3.  **Grouping**: Group keys by feature or component (e.g., `timer.title`, `bible.search`).
4.  **Common Keys**: Use `common.` namespace for shared actions (e.g., `common.confirm`, `common.cancel`, `common.save`). Avoid root-level keys.
5.  **Sync**: Ensure all locale files (`en.json`, `zh-TW.json`, `zh-CN.json`) have the same keys.

## Usage in Code

-   **Vue Templates**: Use `$t('key.path')`.
    ```html
    <v-btn>{{ $t('common.confirm') }}</v-btn>
    ```
-   **Script Setup**: Use `useI18n`.
    ```typescript
    import { useI18n } from 'vue-i18n'
    const { t } = useI18n()
    const msg = t('common.saved')
    ```
-   **Outside Components**: Use `i18n.global.t`.
    ```typescript
    import i18n from '@/plugins/i18n'
    const msg = i18n.global.t('alert.error')
    ```
