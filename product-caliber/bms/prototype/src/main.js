import { createApp } from 'vue'
import { ElAlert } from 'element-plus/es/components/alert/index.mjs'
import { ElButton } from 'element-plus/es/components/button/index.mjs'
import { ElCheckbox, ElCheckboxButton, ElCheckboxGroup } from 'element-plus/es/components/checkbox/index.mjs'
import { ElDatePicker } from 'element-plus/es/components/date-picker/index.mjs'
import { ElDescriptions, ElDescriptionsItem } from 'element-plus/es/components/descriptions/index.mjs'
import { ElDialog } from 'element-plus/es/components/dialog/index.mjs'
import { ElDrawer } from 'element-plus/es/components/drawer/index.mjs'
import { ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus/es/components/dropdown/index.mjs'
import { ElEmpty } from 'element-plus/es/components/empty/index.mjs'
import { ElForm, ElFormItem } from 'element-plus/es/components/form/index.mjs'
import { ElIcon } from 'element-plus/es/components/icon/index.mjs'
import { ElInput } from 'element-plus/es/components/input/index.mjs'
import { ElInputNumber } from 'element-plus/es/components/input-number/index.mjs'
import { ElOption, ElSelect } from 'element-plus/es/components/select/index.mjs'
import { ElPagination } from 'element-plus/es/components/pagination/index.mjs'
import { ElPopover } from 'element-plus/es/components/popover/index.mjs'
import { ElProgress } from 'element-plus/es/components/progress/index.mjs'
import { ElRadio, ElRadioGroup } from 'element-plus/es/components/radio/index.mjs'
import { ElResult } from 'element-plus/es/components/result/index.mjs'
import { ElStep, ElSteps } from 'element-plus/es/components/steps/index.mjs'
import { ElSwitch } from 'element-plus/es/components/switch/index.mjs'
import { ElTable, ElTableColumn } from 'element-plus/es/components/table/index.mjs'
import { ElTabPane, ElTabs } from 'element-plus/es/components/tabs/index.mjs'
import { ElTag } from 'element-plus/es/components/tag/index.mjs'
import { ElText } from 'element-plus/es/components/text/index.mjs'
import { ElTooltip } from 'element-plus/es/components/tooltip/index.mjs'
import { ElUpload } from 'element-plus/es/components/upload/index.mjs'
import 'element-plus/es/components/alert/style/css.mjs'
import 'element-plus/es/components/button/style/css.mjs'
import 'element-plus/es/components/checkbox/style/css.mjs'
import 'element-plus/es/components/date-picker/style/css.mjs'
import 'element-plus/es/components/descriptions/style/css.mjs'
import 'element-plus/es/components/dialog/style/css.mjs'
import 'element-plus/es/components/drawer/style/css.mjs'
import 'element-plus/es/components/dropdown/style/css.mjs'
import 'element-plus/es/components/empty/style/css.mjs'
import 'element-plus/es/components/form/style/css.mjs'
import 'element-plus/es/components/icon/style/css.mjs'
import 'element-plus/es/components/input/style/css.mjs'
import 'element-plus/es/components/input-number/style/css.mjs'
import 'element-plus/es/components/message/style/css.mjs'
import 'element-plus/es/components/message-box/style/css.mjs'
import 'element-plus/es/components/pagination/style/css.mjs'
import 'element-plus/es/components/popover/style/css.mjs'
import 'element-plus/es/components/progress/style/css.mjs'
import 'element-plus/es/components/radio/style/css.mjs'
import 'element-plus/es/components/result/style/css.mjs'
import 'element-plus/es/components/select/style/css.mjs'
import 'element-plus/es/components/steps/style/css.mjs'
import 'element-plus/es/components/switch/style/css.mjs'
import 'element-plus/es/components/table/style/css.mjs'
import 'element-plus/es/components/tabs/style/css.mjs'
import 'element-plus/es/components/tag/style/css.mjs'
import 'element-plus/es/components/text/style/css.mjs'
import 'element-plus/es/components/tooltip/style/css.mjs'
import 'element-plus/es/components/upload/style/css.mjs'
import AppShell from './AppShell.vue'
import { router } from './router/index.js'
import { initializePrototypeData } from './data/prototypeDataService.js'
import '../styles.css'
import '../billing-embedded.css'

async function bootstrap() {
  try {
    await initializePrototypeData()
  } catch (error) {
    console.error('原型数据库初始化失败', error)
  }
  const app = createApp(AppShell).use(router)
  ;[
    ElAlert, ElButton, ElCheckbox, ElCheckboxButton, ElCheckboxGroup, ElDatePicker,
    ElDescriptions, ElDescriptionsItem, ElDialog, ElDrawer, ElDropdown, ElDropdownItem,
    ElDropdownMenu, ElEmpty, ElForm, ElFormItem, ElIcon, ElInput, ElInputNumber, ElOption,
    ElPagination, ElPopover, ElProgress, ElRadio, ElRadioGroup, ElResult, ElSelect, ElStep,
    ElSteps, ElSwitch, ElTable, ElTableColumn, ElTabPane, ElTabs, ElTag, ElText, ElTooltip,
    ElUpload,
  ].forEach((component) => app.component(component.name, component))
  app.mount('#app')
}

bootstrap()
