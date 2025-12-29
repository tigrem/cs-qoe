// Reexport the native module. On web, it will be resolved to CallMetricsModule.web.ts
// and on native platforms to CallMetricsModule.ts
export { default } from './CallMetricsModule';
export { default as CallMetricsView } from './CallMetricsView';
export * from  './CallMetrics.types';
