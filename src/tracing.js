// Load environment variables first
import { config } from "dotenv";
config();
 
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
 
// Define SDK configuration directly with service name
const sdkConfig = {
  serviceName: process.env.OTEL_SERVICE_NAME || "unknown_service",
};


const baseMetricExporter = new OTLPMetricExporter({
  url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`,
});
const traceExporter = new OTLPTraceExporter({
  url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
});
 
const sdk = new NodeSDK({
  ...sdkConfig,
  traceExporter,
  baseMetricExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});
 
try {
  sdk.start();
  console.log("✅ OpenTelemetry tracing initialized");
} catch (error) {
  console.error("❌ Error initializing OpenTelemetry:", error);
}
 
 