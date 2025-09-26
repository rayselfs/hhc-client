<template>
  <div class="projection-content default-projection">
    <div class="logo-container">
      <img src="@/assets/media/hhc-icon.png" alt="HHC" class="hhc-logo" />
    </div>
  </div>
</template>

<script setup lang="ts">
// 預設投影組件，不需要任何 props
</script>

<style scoped>
.default-projection {
  position: relative;
  height: 100vh;
  width: 100vw;
}

.logo-container {
  position: absolute;
  top: 2rem;
  left: 2rem;
}

.hhc-logo {
  width: 40px;
  height: 40px;
  object-fit: contain;
}
</style>
