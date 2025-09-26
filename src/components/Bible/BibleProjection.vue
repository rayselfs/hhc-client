<template>
  <div class="bible-projection">
    <h1>{{ selectedBook }} {{ selectedChapter }}</h1>
    <div class="content">{{ bibleContent }}</div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  selectedBook: string
  selectedChapter: number
  bibleContent: string
}

defineProps<Props>()
</script>

<style scoped>
.bible-projection {
  padding: 2rem;
  text-align: center;
  color: white;
  font-size: 2rem;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.bible-projection::-webkit-scrollbar {
  display: none;
}

.content {
  margin-top: 2rem;
  font-size: 1.5rem;
  line-height: 1.6;
}
</style>
