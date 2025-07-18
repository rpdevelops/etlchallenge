# Customer Data Migration ETL Challenge — Documentation

## Overview

This project demonstrates a complete ETL (Extract, Transform, Load) application designed to migrate customer data from flat CSV files into a relational PostgreSQL database, ensuring data consistency, integrity, and robustness.

The goal was not only to create a migration script but a real-world-ready application capable of handling imports reliably, exposing status monitoring and offering flexibility for future extensions.

---

## Technology Decisions & Rationale

| Tool                 | Reasoning                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **NestJS**           | Chosen for its modular architecture, scalability, dependency injection, and robustness, aligning with enterprise-grade application development. |
| **Knex.js**          | Provides fine-grained control over SQL operations, enables atomic transactions, and ensures precise query building without ORM abstractions.    |
| **Railway**          | Simplifies deployment with PostgreSQL hosting and cloud execution.                                                                              |
| **Supabase Storage** | Serves as a cloud storage solution for uploaded CSV files, decoupling file persistence from the processing logic.                               |

---

## Architectural Overview

### Upload & Initial Validation

* Static web pages served by NestJS allow users to upload CSV files.
* Uploaded files are validated for:

  * Encoding correctness
  * Empty content
  * Expected headers
* Files passing validation are stored in **Supabase Storage**.
* A reference is registered in the `migrationsControl` table with a **status flag** (e.g., `new`).

### Scheduled Job Processing

* Using **@nestjs/schedule**, scheduled jobs check for files marked as `new` in `migrationsControl`.
* Jobs:

  * Update file status to `PROCESSING`.
  * Process CSV data line by line:

    * Validate required fields.
    * Transform data (e.g., date parsing, phone sanitization).
    * Handle foreign keys & ensure referential integrity.
    * Insert data into respective tables using atomic transactions.
  * Upon completion, update file status to `processed` or `error` accordingly.

### Logging

* Logs are recorded both in the database and console.
* Audit trails of processing activities including:

  * Successful operations
  * Ignored/duplicate records
  * Errors and rollback events

---

## ADRs (Architecture Decision Records)

| Decision                      | Rationale                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| Use of NestJS                 | Provides modularity, testability, and production-ready design patterns.             |
| Knex over ORM                 | Ensures transactional control and avoids hidden ORM behaviors.                      |
| Scheduled jobs with NestJS    | Keeps all logic inside a single, deployable application.                            |
| External Storage (Supabase)   | Decouples file storage from processing environment, suitable for cloud-native apps. |
| Single application on Railway | Simplifies deployment, testing, and operational monitoring.                         |

---

## Deployment & Execution

### Environment

* Hosted on **Railway** (Application + PostgreSQL):
  - https://etlchallenge-production.up.railway.app/
* File Storage on **Supabase Storage (S3 Compatible)**

### Running Locally

1. Clone the repository.
2. Install dependencies:

   ```bash
   npm install
   ```
3. Configure `.env` with:

   * `DATABASE_CONNECTION_STRING`
   * `SUPABASE_URL`
   * `SUPABASE_KEY`
   * `API_BASE_URL` (locally put: http://localhost:3000 )

4. Run the application:

   ```bash
   npm run start:dev
   ```
5. Access:

   * Static file upload interface: `http://localhost:3000`

---

## Assumptions

* The provided CSVs strictly follow the expected headers and structure.
* `facility` and `unit` data are imported with `unit.csv` before processing `rentRoll.csv`.
* The number of unit accepts also characters (In case of codes to units like: A001)
* Each tenant is uniquely identified by the combination of firstName, lastName, and email.
* Duplicate rental contracts are avoided by checking for existing contracts with the same unitId, tenantId, and startDate before insertion.
* Each rental contract has exactly one rental invoice created during the import process.
* The rent amounts and dates provided in the CSV are considered correct and trusted for insertion.
* Missing or malformed records are logged and skipped without stopping the entire migration process.
* The migration process is designed to be idempotent — running it multiple times on the same files does not create duplicates.
* The dates in rentRoll.csv follows the standard yyyy/mm/dd

---

## Challenges Handled

* Data validation (headers, required fields, encoding)
* Data transformation (dates, phone numbers)
* Foreign key lookups and creation
* Atomic transactions with rollback on failure
* Logging with status updates
* Processing idempotency by verifying existing records before insert

---

## How to Run the Migration

1. Upload `unit.csv` via web interface.
2. Upload `rentRoll.csv` via web interface.
3. Monitor processing via Logs Panel in web interface.
4. Check `migrationsControl` table for file status.
5. Review inserted records in the database in data section on web interface.

---

## Bonus Implementations

* Logs of ignored or malformed rows for auditing.
* Idempotent processing (safe to re-run imports).
* Exposed API for monitoring processed data.

---

## Known Limitations & Future Improvements

* Bulk inserts could be optimized for large datasets.
* Logging can be further integrated with external monitoring (e.g., Logflare).
* UI could be enhanced for better UX.
* In case to import more than one invoice (sum all of them to contract)

---

## Conclusion

This solution is built not only to solve the exercise but to reflect a real-world scenario where data migration needs control, visibility, and robustness. By leveraging NestJS and Knex, combined with scheduled tasks and cloud storage, the application stands as a complete ETL pipeline ready for production use.

---

## Data Security Considerations

* Connection strings and secrets managed via environment variables.
* Validations prevent injection attacks.
* Processed files isolated from application logic.
* Transactions ensure data consistency.

---

## Contact & Support

For questions or suggestions, please reach out via the repository issues section or contact `paradellarobson@gmail.com`.
