<script setup>
defineProps({
  primary: { type: [String, Number], default: '' },
  secondary: { type: [String, Number], default: '' },
})
</script>

<template>
  <div class="main-cell">
    <strong>{{ primary }}</strong>
    <small v-if="secondary !== ''">{{ secondary }}</small>
    <slot />
  </div>
</template>
