import * as React from 'react';

import { CallMetricsViewProps } from './CallMetrics.types';

export default function CallMetricsView(props: CallMetricsViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
