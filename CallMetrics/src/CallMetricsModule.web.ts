import { registerWebModule, NativeModule } from 'expo';

import { CallMetricsModuleEvents } from './CallMetrics.types';

class CallMetricsModule extends NativeModule<CallMetricsModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(CallMetricsModule, 'CallMetricsModule');
