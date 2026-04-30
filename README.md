# Transaction Reconciliation Engine

## Overview
This is a Node.js based Transaction Reconciliation Engine that ingests crypto transaction datasets from a user and an exchange, matches them based on configurable tolerances, and produces a structured reconciliation report.

## Prerequisites
- Node.js (v14 or higher)
- MongoDB

## Setup Instructions
1. Clone the repository.
2. Install dependencies: `npm install`
3. Create a `.env` file in the root directory:
   ```env
   PORT=3000
   MONGODB_URI=mongodb+srv://sowmithpothuganti_db_user:BU7BiREdjPwOhMAj@cluster0.dqmiag0.mongodb.net/?appName=Cluster0
   TIMESTAMP_TOLERANCE_SECONDS=300
   QUANTITY_TOLERANCE_PCT=0.01
   ```
4. Start the server: `npm start` (or `node server.js`)

## API Endpoints

### 1. Trigger Reconciliation Run
- **Method**: `POST`
- **Endpoint**: `/reconcile`
- **Description**: Trigger reconciliation run by uploading the two CSV files.
- **Form-Data**:
  - `user_transactions`: (File) The CSV from the user.
  - `exchange_transactions`: (File) The CSV from the exchange.
  - `timestampToleranceSeconds`: (Optional) Custom timestamp tolerance in seconds.
  - `quantityTolerancePct`: (Optional) Custom quantity tolerance in percentage.
- **Response**: `{ "message": "Reconciliation completed", "runId": "uuid..." }`

### 2. Fetch Full Reconciliation Report
- **Method**: `GET`
- **Endpoint**: `/report/:runId`
- **Description**: Downloads the full reconciliation report in CSV format.

### 3. Fetch Summary
- **Method**: `GET`
- **Endpoint**: `/report/:runId/summary`
- **Description**: Returns the JSON summary count of matched, conflicting, and unmatched transactions.

### 4. Fetch Unmatched Rows
- **Method**: `GET`
- **Endpoint**: `/report/:runId/unmatched`
- **Description**: Returns JSON array of all unmatched transaction rows with reasons.

## Key Decisions & Assumptions
- **Synchronous vs Asynchronous Processing**: I process the files synchronously to immediately return the `runId` with a completed state. In a true highly-scaled production environment with massive files, this would be delegated to a message queue (e.g., BullMQ, RabbitMQ) and worker processes. 
- **CSV Headers Handling**: Since "data has been intentionally made messy", the CSV parser implements a generic header matching strategy that searches for common synonyms like `date`, `created_at` for timestamp; `amount`, `size` for quantity, etc.
- **Data Normalization**: Values are dynamically parsed and normalized (e.g. `BITCOIN` to `BTC`). If fields are completely unparseable, rows are flagged with a specific `invalidReason` rather than dropped.
- **Reporting**: The generated CSV report dynamically merges columns from both the user and exchange transactions so that no raw data is lost, appending `User_` and `Exchange_` prefixes to the headers.
- **Type Aliasing**: `TRANSFER_OUT` from the user's perspective is considered equivalent to `TRANSFER_IN` from the exchange's perspective and vice versa.
- **Percentage Configuration Logic**: Updated percentage evaluation so if the `.env` specifies a quantity tolerance like `0.01`, it correctly evaluates as a percentage mathematically instead of comparing against flat decimal ratios, making configuration much more intuitive.
