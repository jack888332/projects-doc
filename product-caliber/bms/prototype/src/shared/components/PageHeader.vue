<template>
  <Teleport v-if="$slots.actions" to="#route-page-actions">
    <slot name="actions" />
  </Teleport>
</template>
