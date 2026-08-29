import DefaultTheme from 'vitepress/theme'
import CapabilityMatrix from './components/CapabilityMatrix.vue'
import ConfigDiff from './components/ConfigDiff.vue'
import LabOutput from './components/LabOutput.vue'
import MessageTrace from './components/MessageTrace.vue'
import ProductLogo from './components/ProductLogo.vue'
import TopologyDiagram from './components/TopologyDiagram.vue'
import VersionBadge from './components/VersionBadge.vue'
import DockerTooling from './components/DockerTooling.vue'
import MqPlayground from './components/MqPlayground.vue'
import './doc-baseline.css'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('CapabilityMatrix', CapabilityMatrix)
    app.component('ConfigDiff', ConfigDiff)
    app.component('LabOutput', LabOutput)
    app.component('MessageTrace', MessageTrace)
    app.component('ProductLogo', ProductLogo)
    app.component('TopologyDiagram', TopologyDiagram)
    app.component('VersionBadge', VersionBadge)
    app.component('DockerTooling', DockerTooling)
    app.component('MqPlayground', MqPlayground)
  },
}
