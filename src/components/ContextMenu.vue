<template>
  <v-menu
    v-model="showMenu"
    :target="menuTarget"
    :open-on-click="false"
    location="bottom start"
    :close-on-content-click="closeOnContentClick"
    @click:outside="isControlled && $emit('update:modelValue', false)"
  >
    <slot v-if="props.raw" />
    <v-list v-else density="compact" class="rounded-lg">
      <slot>
        <template v-if="props.items && props.items.length > 0">
          <v-list-item
            v-for="item in props.items.filter((i) => !i.condition || i.condition())"
            :key="item.id || item.label"
            @click="handleItemClick(item)"
          >
            <template #prepend>
              <v-icon>{{ item.icon }}</v-icon>
            </template>
            <v-list-item-title>{{ item.label }}</v-list-item-title>
          </v-list-item>
        </template>
      </slot>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useContextMenu } from '@/composables/useContextMenu'

export interface ContextMenuItem {
  id?: string
  label: string
  icon: string
  action?: () => void
  condition?: () => boolean
}

interface Props {
  items?: ContextMenuItem[]
  closeOnContentClick?: boolean
  modelValue?: boolean
  // priority higher than position
  activator?: HTMLElement | string
  position?: [number, number]
  raw?: boolean
}

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  closeOnContentClick: false,
  raw: false,
})

const { show: internalShow, x: internalX, y: internalY, open, close } = useContextMenu()

const isControlled = computed(() => {
  return props.modelValue !== undefined
})

const showMenu = computed({
  get: () => (isControlled.value ? props.modelValue : internalShow.value),
  set: (val) => {
    if (isControlled.value) {
      emit('update:modelValue', val)
    } else {
      internalShow.value = val
    }
  },
})

const menuTarget = computed(() => {
  if (props.activator) return props.activator
  if (props.position) return props.position
  return [internalX.value, internalY.value] as [number, number]
})

const handleItemClick = (item: ContextMenuItem) => {
  if (item.action) {
    item.action()
  }
  close()
  if (isControlled.value) {
    emit('update:modelValue', false)
  }
}

defineExpose({
  open,
  close,
})
</script>
