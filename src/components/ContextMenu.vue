<template>
  <v-menu
    v-model="show"
    :target="[x, y]"
    location="bottom start"
    :close-on-content-click="closeOnContentClick"
  >
    <v-list density="compact">
      <slot>
        <!-- 默認使用配置的選單項（如果提供了 items prop） -->
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
import { useContextMenu } from '@/composables/useContextMenu'

export interface ContextMenuItem {
  id?: string
  label: string
  icon: string
  action?: () => void
  condition?: () => boolean
}

interface Props {
  /**
   * 選單項配置
   * 如果不提供，則使用 slot 自定義內容
   */
  items?: ContextMenuItem[]
  /**
   * 點擊選單項內容時是否關閉選單
   */
  closeOnContentClick?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  closeOnContentClick: false,
})

// 使用 useContextMenu composable 管理選單狀態
const { show, x, y, open, close } = useContextMenu()

// 處理選單項點擊
const handleItemClick = (item: ContextMenuItem) => {
  if (item.action) {
    item.action()
  }
  close()
}

// 暴露方法供外部使用
defineExpose({
  open,
  close,
})
</script>
