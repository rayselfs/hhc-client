<template>
  <div>
    <h3 class="text-h6 mb-2">{{ title }}</h3>
    <v-divider></v-divider>
    <div class="shortcuts-list pt-3">
      <div
        v-for="shortcut in shortcuts"
        :key="shortcut.key"
        class="shortcut-item pb-3 align-center justify-space-between d-flex"
      >
        <span class="shortcut-description">{{ shortcut.description }}</span>
        <v-chip size="small" variant="outlined" class="shortcut-key">
          {{ shortcut.key }}
        </v-chip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface ShortcutItem {
  key: string
  description: string
}

defineProps<{
  title: string
  shortcuts: ShortcutItem[]
}>()
</script>

<style scoped>
.shortcut-item {
  min-height: 40px;
  margin-left: 16px;
}

.shortcut-description {
  flex: 1;
  font-size: 0.95rem;
  margin-right: 16px;
}

.shortcut-key {
  font-family: 'Courier New', monospace;
  font-weight: bold;
  min-width: 120px;
  justify-content: center;
  flex-shrink: 0;
}
</style>
