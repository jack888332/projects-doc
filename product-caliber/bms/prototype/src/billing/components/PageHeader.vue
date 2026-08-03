<script setup>
defineProps({
  eyebrow: { type: String, default: 'BMS' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
})
</script>

<template>
  <div class="module-heading">
    <div>
      <div v-if="eyebrow" class="eyebrow">{{ eyebrow }}</div>
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </div>
    <div class="module-heading-actions"><slot name="actions" /></div>
  </div>
</template>
