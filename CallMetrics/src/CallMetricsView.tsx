import { requireNativeView } from 'expo';
import * as React from 'react';

import { CallMetricsViewProps } from './CallMetrics.types';

const NativeView: React.ComponentType<CallMetricsViewProps> =
  requireNativeView('CallMetrics');

export default function CallMetricsView(props: CallMetricsViewProps) {
  return <NativeView {...props} />;
}
