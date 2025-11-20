
---

# 📘 **OpenTelemetry + Grafana Cloud Integration (Node.js + Express + Mongoose)**

## ✨ Overview

This project integrates **OpenTelemetry** with a Node.js backend and exports **Traces**, **Metrics**, and **Spans** to **Grafana Cloud (Tempo + Mimir + Loki)** using the **OTLP HTTP exporter**.

With this setup, you can:

* Monitor API performance
* Track database queries (Mongoose/MongoDB)
* Analyze request slowness
* Build distributed tracing
* View real-time service performance
* Detect errors & bottlenecks

---

# 🚀 **Features**

* ✔ Auto-Instrumentation (Express, HTTP, MongoDB/Mongoose)
* ✔ Manual Custom Spans (API logic, internal functions, DB operations)
* ✔ OTLP Export to Grafana Cloud
* ✔ Tracing + Metrics Export
* ✔ Detailed logs for debugging
* ✔ Production-ready configuration

---

# 📡 **Architecture**

```
Node.js → OpenTelemetry SDK → OTLP Exporter → Grafana Cloud → Tempo (Traces)
                                                             → Mimir (Metrics)
                                                             → Loki (Logs)
```

---

# 🔧 **1. Installation**

```bash
npm install @opentelemetry/api \
@opentelemetry/sdk-node \
@opentelemetry/exporter-trace-otlp-http \
@opentelemetry/exporter-metrics-otlp-http \
@opentelemetry/auto-instrumentations-node \
@opentelemetry/instrumentation-mongodb \
dotenv
```

---

# 🗂 **2. Project Structure**

```
/project
  ├── tracing.js     # OpenTelemetry initialization file
  ├── index.js       # Express entry point
  ├── .env           # Grafana Cloud credentials
  └── package.json
```
---
# 🔐 **3. Configure Grafana Cloud**

1. Go to **Grafana Cloud → Connections → OpenTelemetry**
2. Copy:
    * OTLP endpoint
    * Bearer Token

Add a screenshot/photo to help locate the fields:

![Grafana Cloud — OpenTelemetry Connections screenshot](./assets/Screenshot%202025-11-20%20181449.png)
![Grafana Cloud — OpenTelemetry Connections screenshot](./assets/Screenshot%202025-11-20%20181604.png)
![Grafana Cloud — OpenTelemetry Connections screenshot](./assets/Screenshot%202025-11-20%20181716.png)

!Please also copy and paste this environment configuration, ensuring to remove the export keywords.

Example:

```
OTLP Endpoint:
https://otlp-gateway-prod-ap-south-1.grafana.net/otlp

Header:
Authorization=Bearer glc_xxx...
```
---

# 📄 **4. Add .env File**

```env
# Grafana Cloud OTLP
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-ap-south-1.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer glc_eyJvIjoiMTU3NT...

# OpenTelemetry service name
OTEL_SERVICE_NAME=grafana-node-mongoDB

NODE_ENV=production
```

---

# ⚙ **5. tracing.js (Full Working Version)**

This file initializes OpenTelemetry and exports traces + metrics to Grafana Cloud.

```js
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
```

---

# 🧵 **6. Import tracing.js First in server.js**

```js
import "./tracing.js"; // MUST be first!!

import express from "express";
import mongoose from "mongoose";

const app = express();
```

If this import is NOT the first line, **no spans will be captured**.

---

# 🛠 **7. Adding Custom Spans**

Auto-instrumentation traces all Express & DB calls.

But you can create your own spans:

---

## ✔ **7.1 API Span Example**

```js

const tracer = trace.getTracer("api-tracer");


const CreateUser = asyncHandler( async (req, res) => {
    const span = tracer.startSpan("create_user_api");
    try {
        const { userName, email, password } = req.body;
    
        const validationSpan = tracer.startSpan("validate_user_input", { parent: span });
        if (!userName || !email || !password) {
            validationSpan.end();
            throw new ApiError(400, "Username, email, and password are required");
        }
        validationSpan.end();
    
        const existingUser = await User.findOne({ $or: [ { userName }, { email } ] });
        
        if (existingUser) {
            throw new ApiError(400, "User with the given username or email already exists");
        }
    
        const creationSpan = tracer.startSpan("create_user_in_db", { parent: span });
        const newUser = await User.create({ 
            userName, 
            email, 
            password,
            registrationDate: new Date()
        });
        creationSpan.setAttribute("user.id", newUser._id.toString());
        creationSpan.end();
    
        if (!newUser) {
            throw new ApiError(500, "Failed to create user");
        }
    
        const retrievalSpan = tracer.startSpan("retrieve_created_user", { parent: span });
        const createdUser = await User.findById(newUser._id).select("-password -__v");
        retrievalSpan.end();
    
        if (!createdUser) {
            throw new ApiError(500, "Failed to retrieve created user");
        }
    
        span.setAttribute("user.id", createdUser._id.toString());
        span.end();
        return res
            .status(201)
            .json(new ApiResponse(
                201, 
                createdUser, 
                "User created successfully"
            ));
    } catch (error) {
        span.recordException(error);
        res.status(400).json({ error: error.message });
    }finally{
        span.end();
    }
})
```

---

## ✔ **7.2 Function Span Example**

```js
function processData(data) {
  const span = tracer.startSpan("process-data");
  let result = data * 10;
  span.end();
  return result;
}
```

---

## ✔ **7.3 DB Query Span Example**

```js
const dbSpan = tracer.startSpan("db-find-user");
const user = await User.findById(id);
dbSpan.end();
```

---

# 📊 **8. Viewing Traces in Grafana Cloud**

### Go to:

```
Grafana → Explore → Tempo → Search
```


Search using:

```
service.name = grafana-node-mongoDB
```

You will see:

* Root traces
* Each API span
* DB span
* Errors
* Response time
* Flame graph
* Waterfall timeline

![Grafana Cloud — OpenTelemetry Connections screenshot](./assets/Screenshot%202025-11-20%20182353.png)
![Grafana Cloud — OpenTelemetry Connections screenshot](./assets/Screenshot%202025-11-20%20182419.png)
![Grafana Cloud — OpenTelemetry Connections screenshot](./assets/Screenshot%202025-11-20%20182617.png)

---

# 🏭 **9. Production Deployment Guide**

### ✔ Environment Variables

Use **Grafana Cloud Prod OTLP URL** in `.env.production`.

### ✔ Node Startup

If using PM2:

```
pm2 start server.js --node-args="--require ./tracing.js"
```

### ✔ Security

Store Grafana API tokens in GitHub Secrets / Docker Secrets.

### ✔ Scaling

OpenTelemetry supports:

* Load balancers
* Multiple Node instances
* Multi-region deployment

### ✔ Performance Impact

OTel overhead: **< 5% CPU**, negligible memory impact.

---

# 📦 **10. Docker Support**

Dockerfile Example:

```dockerfile
ENV OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway.../otlp
ENV OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer glc_xxx"
ENV OTEL_SERVICE_NAME=grafana-node-mongoDB
```

---

# 📈 Dashboards & Visualization

Grafana → Dashboards → Import → Use ID: **16827**
(OpenTelemetry Node.js Dashboard)

This gives:

* CPU/Mem usage
* Request latency
* DB latency
* Service map
* Error count
* Span waterfall

---

# 💡 Troubleshooting

### 🚫 No traces showing?

* tracing.js not imported FIRST
* Wrong OTLP header format
* Wrong Grafana endpoint
* .env not loading
* Missing Bearer token
* Using PM2 without `--node-args`

### 🧪 Debug logs

Enable:

```js
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
```

---

# 🏁 Conclusion

With this setup, you get:

✔ End-to-end Observability
✔ Real-time performance insights
✔ Auto + custom spans
✔ Full distributed tracing
✔ Professional monitoring for production

---
