<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 })
const paths: Record<string, string> = {
  week: 'M8 3v4m8-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm3 9h3m-3 3h6',
  plan: 'M4 5h16M4 12h16M4 19h16M8 3v4m7 3v4m-4 3v4',
  activity: 'M3 12h4l3-7 4 14 3-7h4',
  settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  arrow: 'm9 5 7 7-7 7',
  down: 'm6 9 6 6 6-6',
  check: 'm5 12 4 4L19 6',
  plus: 'M12 5v14M5 12h14',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',
  download: 'M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4',
  flag: 'M5 21V4m0 0c5-5 9 5 14 0v10c-5 5-9-5-14 0',
  link: 'm10 14 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',
  close: 'm6 6 12 12M6 18 18 6',
}
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.activity" />
  </svg>
</template>
