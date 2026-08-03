<script setup>
const props = defineProps({
  items: { type: Array, default: () => [] },
  columns: { type: Number, default: 4 },
  clickable: { type: Boolean, default: false },
  activeKey: { type: [String, Number], default: '' },
})

const emit = defineEmits(['select'])
</script>

<template>
  <div :class="['module-kpis', columns === 3 ? 'three' : 'four']">
    <component
      :is="clickable ? 'button' : 'div'"
      v-for="item in items"
      :key="item.key ?? item.label"
      :type="clickable ? 'button' : undefined"
      :class="['module-kpi', item.tone || 'slate', { active: activeKey === (item.key ?? item.label) }]"
      @click="clickable && emit('select', item.key ?? item.label)"
    >
      <span>{{ item.label }}</span>
      <strong>{{ item.value }}</strong>
      <small v-if="item.extra">{{ item.extra }}</small>
    </component>
  </div>
</template>
