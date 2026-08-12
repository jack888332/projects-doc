<script>
import { defineComponent, h, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElTableColumn as ElementTableColumn, ElTooltip } from 'element-plus'
import SortDirectionIcon from '../components/SortDirectionIcon.vue'

const NON_DATA_TYPES = new Set(['selection', 'index', 'expand'])

const LABEL_SORT_KEYS = {
  供应商名称: ['name', 'supplier'],
  适用成本板块: ['boards', 'board'],
  板块账期配置: ['periodConfigs', 'cycles'],
  成本账单编号: ['id', 'billNo', 'no'],
  分摊集编号: ['id', 'no'],
  账单金额: ['amount'],
  已结清金额: ['settled'],
  金额: ['amount'],
  状态: ['status', 'state'],
  账单状态: ['status', 'state'],
  审核状态: ['status', 'reviewStatus'],
  成本完整性: ['status', 'completeness'],
  生效周期: ['effectStart', 'effective'],
  最近操作: ['updatedAt', 'operator'],
  '优先 / 兜底因子': ['factor', 'fallback'],
  纳入: ['selected'],
  费项: ['fee', 'feeCode'],
  结算币种: ['currency', 'mode'],
  固定币种: ['currency'],
  应收金额: ['receivable', 'amount'],
  已收金额: ['received'],
  应收未收: ['outstanding'],
  逾期未收: ['overdue'],
  待审核金额: ['pendingReview'],
  未收金额: ['amount', 'outstanding'],
  已核销金额: ['written', 'paid'],
  待核销金额: ['pending'],
  运费: ['freight'],
  派送附加费: ['deliverySurcharge', 'surcharge'],
  仓储费: ['warehouseFee', 'storageFee'],
  操作费: ['operationFee'],
  结算金额: ['amount', 'settlementAmount'],
  金额变幅: ['delta'],
  核销金额: ['amount'],
  原始货款: ['original'],
  应返货款: ['refundable'],
  已返货款: ['returned', 'refunded'],
  待返货款: ['pending'],
  扣减金额: ['amount'],
  锁定汇率: ['rate'],
  回款状态: ['recoveryStatus'],
  返款状态: ['refundStatus'],
  回款金额: ['recoveryAmount'],
  货币对: ['direction', 'pair'],
  汇率: ['rate', 'result'],
  任务状态: ['status'],
  任务类型: ['taskType', 'type'],
  账单生成方式: ['generationMode'],
  触发方式: ['triggerType', 'trigger'],
  账单配置: ['configCode', 'config'],
  导出进度: ['progress'],
  执行结果: ['result'],
  财务侧报表: ['finance'],
  系统侧报表: ['system'],
  '基础运费（财务侧）': ['financeFreight'],
  '基础运费（系统侧）': ['systemFreight'],
  '派送附加费（财务侧）': ['financeSurcharge'],
  '派送附加费（系统侧）': ['systemSurcharge'],
  货款原始币种: ['sourceCurrency'],
  货款结算币种: ['settlementCurrency'],
  客户收款账户: ['accountName', 'accountNo'],
  客户: ['customer', 'customerName', 'customerNo'],
  '拉取 / 命中': ['pulled', 'matched'],
}

const DYNAMIC_LABEL_SORT_KEYS = [
  [/结算币种金额$/, ['amount', 'original']],
  [/（财务侧）$/, ['finance']],
  [/（系统侧）$/, ['system']],
]

const PrototypeTableHeaderLabel = defineComponent({
  name: 'PrototypeTableHeaderLabel',
  props: {
    label: { type: String, required: true },
    sortable: { type: Boolean, default: false },
  },
  setup(props) {
    const labelElement = ref(null)
    const truncated = ref(false)
    let resizeObserver

    function updateOverflow() {
      const element = labelElement.value
      truncated.value = Boolean(element && element.scrollWidth > element.clientWidth + 1)
    }

    onMounted(() => {
      nextTick(updateOverflow)
      if (typeof ResizeObserver !== 'undefined' && labelElement.value) {
        resizeObserver = new ResizeObserver(updateOverflow)
        resizeObserver.observe(labelElement.value)
      }
    })

    onBeforeUnmount(() => resizeObserver?.disconnect())
    watch(() => props.label, () => nextTick(updateOverflow))

    return () => h(ElTooltip, {
      content: props.label,
      disabled: !truncated.value,
      placement: 'top',
      showAfter: 0,
      hideAfter: 0,
      popperClass: 'prototype-table-header-tooltip',
    }, {
      default: () => h('span', {
        class: 'prototype-table-header-content',
      }, [
        h('span', {
          ref: labelElement,
          class: 'prototype-table-header-label',
        }, props.label),
        props.sortable
          ? h('button', {
              type: 'button',
              class: 'prototype-table-header-sort-button',
              title: '列数据排序',
              'aria-label': `${props.label}列数据排序`,
            }, [
              h(SortDirectionIcon, {
                class: 'prototype-table-header-sort-indicator',
              }),
            ])
          : null,
      ]),
    })
  },
})

function estimatedHeaderWidth(label, sortable) {
  const textWidth = Array.from(label).reduce((width, character) => {
    if (/\p{Script=Han}/u.test(character)) return width + 14
    if (/\s/.test(character)) return width + 4
    return width + 8
  }, 0)
  return Math.ceil(textWidth + 28 + (sortable ? 18 : 0))
}

function syntheticSortProperty(label) {
  const encoded = Array.from(label)
    .map((character) => character.codePointAt(0).toString(16))
    .join('_')
  return `__prototype_sort_${encoded}`
}

function numericWidth(value) {
  if (value == null || value === '') return 0
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function sortKeysFor(label) {
  if (LABEL_SORT_KEYS[label]) return LABEL_SORT_KEYS[label]
  return DYNAMIC_LABEL_SORT_KEYS.find(([pattern]) => pattern.test(label))?.[1] || []
}

function rowValue(row, label, sortKey) {
  if (typeof sortKey === 'function') return sortKey(row)
  const candidates = sortKey ? [sortKey] : sortKeysFor(label)
  const key = candidates.find((candidate) => Object.prototype.hasOwnProperty.call(row, candidate))
  return key ? row[key] : ''
}

function comparable(value) {
  if (value == null) return { kind: 0, value: '' }
  if (typeof value === 'boolean') return { kind: 1, value: Number(value) }
  if (typeof value === 'number') return { kind: 1, value }
  if (Array.isArray(value)) return { kind: 2, value: value.join('、') }
  if (typeof value === 'object') return { kind: 2, value: JSON.stringify(value) }

  const text = String(value).trim()
  const numeric = text.replace(/,/g, '').match(/^(-?\d+(?:\.\d+)?)(?:\s*[A-Za-z]{3}|\s*[%个份家笔条天秒])?$/)
  if (numeric) return { kind: 1, value: Number(numeric[1]) }
  return { kind: 2, value: text }
}

function compareValues(left, right) {
  const a = comparable(left)
  const b = comparable(right)
  if (a.kind !== b.kind) return a.kind - b.kind
  if (a.kind === 1) return a.value - b.value
  return String(a.value).localeCompare(String(b.value), 'zh-CN', { numeric: true })
}

export default defineComponent({
  name: 'PrototypeTableColumn',
  inheritAttrs: false,
  props: {
    sortKey: { type: [String, Function], default: '' },
  },
  setup(props, { attrs, slots }) {
    const columnDataSort = inject('prototypeTableColumnDataSort', null)

    return () => {
      const label = typeof attrs.label === 'string' ? attrs.label : ''
      const excluded = NON_DATA_TYPES.has(attrs.type) || label === '操作'
      const explicitlyDisabled = attrs.sortable === false || attrs.sortable === 'false'
      const frameSortingDisabled = columnDataSort?.value === false
      const sortable = excluded || explicitlyDisabled || frameSortingDisabled ? false : (attrs.sortable ?? true)
      const forwarded = { ...attrs, sortable }

      if (label === '操作') forwarded.resizable = false

      if (!excluded) {
        const headerWidth = estimatedHeaderWidth(label, sortable)
        const declaredWidth = numericWidth(attrs.width)
        const declaredMinWidth = numericWidth(attrs.minWidth)

        forwarded.showOverflowTooltip = attrs.showOverflowTooltip ?? true
        if (declaredWidth) forwarded.width = Math.max(declaredWidth, headerWidth)
        else forwarded.minWidth = Math.max(declaredMinWidth, headerWidth)
      }

      if (sortable && !attrs.prop && !attrs.sortMethod) {
        forwarded.prop = syntheticSortProperty(label)
        forwarded.sortMethod = (left, right) => compareValues(
          rowValue(left, label, props.sortKey),
          rowValue(right, label, props.sortKey),
        )
      }

      const forwardedSlots = label && !slots.header
        ? {
            ...slots,
            header: () => h(PrototypeTableHeaderLabel, {
              label,
              sortable: Boolean(sortable),
            }),
          }
        : slots

      return h(ElementTableColumn, forwarded, forwardedSlots)
    }
  },
})
</script>
