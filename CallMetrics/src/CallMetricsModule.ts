import { NativeModule, requireNativeModule } from 'expo';

import {
  CallMetricsModuleEvents,
  CallStateChangePayload,
} from './CallMetrics.types';

declare class CallMetricsModule extends NativeModule<CallMetricsModuleEvents> {
  isPermissionGranted(): boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
}

// This call loads the native module object from the JSI.
const module = requireNativeModule<CallMetricsModule>('CallMetrics');

export default module;
export type { CallStateChangePayload };
