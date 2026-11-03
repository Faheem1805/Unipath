# UniPath: My First Azure Deployment

[Failure playbook and interview practice](FAILURE-PLAYBOOK.md)

Deployment date: 23 October 2026

CI verification and documentation update: 24 October 2026

## Goal

Deploy the existing UniPath application myself and learn how to operate it in the cloud. My hands-on work covered Azure infrastructure, Linux, SSH, Docker, GitHub authentication, troubleshooting, and database recovery.

## Infrastructure

- Azure for Students subscription.
- Resource group: `rg-unipath-dev`.
- VM: `vm-unipath-dev`, deployed in Denmark East.
- Size: `Standard_B2als_v2`, with 2 vCPUs and 4 GiB RAM.
- Operating system: Ubuntu Server 24.04 LTS.
- Storage: 30 GiB Standard SSD.
- Trusted Launch, Secure Boot, and vTPM enabled.
- Tags: `project=unipath` and `environment=dev`.
- SSH access restricted to my public IP address.
- A monthly subscription budget of US$10 configured for spending alerts.

## Application Architecture

My browser → local SSH tunnel → Azure VM → Nginx frontend → Express API → PostgreSQL.

Docker Compose runs the application services. PostgreSQL stores its data in a persistent Docker volume.

The frontend is bound to the VM's loopback interface. I access it through an encrypted SSH tunnel rather than exposing port 8080 publicly.

## Deployment

I connected to the VM from Ubuntu running through WSL on my Windows computer.

I installed Docker, Docker Compose, the Docker build tool, and Git. I then cloned the private GitHub repository using a dedicated read-only deploy key.

I generated the application's environment configuration and built and started the services with Docker Compose.

I created a test account, entered course progress, and saved a semester plan.

## Problems I Investigated

### VM sizes unavailable

Azure reported `NotAvailableForSubscription` for sizes in UAE North.

I learned that regional policy, VM-family quota, and size availability are separate checks. After investigating the subscription's permitted regions and size restrictions, I deployed in Denmark East.

### GitHub password authentication rejected

Cloning over HTTPS failed because GitHub does not accept account passwords for Git operations.

I generated an SSH key on the VM and added its public key as a read-only deploy key for the repository.

### Private key permissions rejected

SSH rejected the private key in my Windows Downloads folder because WSL reported overly broad permissions.

I used a copy inside my Ubuntu home directory, with permission mode 700 for `.ssh` and 600 for the private key.

### CI container network and Docker Compose compatibility

The acceptance suite initially failed when reserving a container's old IP address. Docker required an explicitly configured network subnet for that fixed-IP reservation. An explicit subnet was added to the disposable acceptance network.

The next failure was caused by a tooling-version difference: the GitHub runner used Docker Compose v2.38.2, which rejected `start --wait`, while the newer local Compose version accepted it. The test restart commands were changed to `up -d --no-deps --wait`, retaining the health checks without rerunning completed provisioning jobs.

The CI helper was also improved to identify the failing test stage, print redacted command errors, and upload redacted diagnostics on failure. This made it possible to distinguish a test-infrastructure problem from an application failure.

## Persistence Test

I restarted the application containers and confirmed that my account and saved records remained available.

This demonstrated persistence across container restarts. It did not prove protection against losing the VM or disk.

## Database Outage Exercise

I deliberately stopped PostgreSQL.

The API's liveness endpoint remained responsive, while its readiness endpoint returned HTTP 503 because the database was unavailable.

After restarting PostgreSQL, readiness recovered without restarting the API.

I learned that a process can be running while the application is unable to serve database-backed requests.

## Backup and Restore Exercise

I created a PostgreSQL custom-format dump using `pg_dump`.

I restored it into a separate database named `unipath_restore_check`, leaving the application's original database intact.

The original and restored databases had matching counts:

| Records         | Original | Restored |
| --------------- | -------: | -------: |
| Users           |        1 |        1 |
| Course attempts |        5 |        5 |
| Semester plans  |        1 |        1 |
| Curricula       |        1 |        1 |

I also copied the dump onto my local computer using SCP.

I compared the SHA-256 checksum of the downloaded file with the VM copy and confirmed they matched.

This verified a database restore and matching counts for these tables. I have not yet tested running the full application against the restored database.

## GitHub Actions Verification

On 24 October 2026, both jobs passed on GitHub for commit `14737ea`:

- `checks`: formatting, lint, TypeScript checks, builds, unit tests, and PostgreSQL API tests.
- `containers-and-browser`: all 15 acceptance groups, including browser workflows, persistence, changed-IP backend replacement, active and idle shutdown, dependency recovery, backup restoration, and safe logging.

[Successful GitHub Actions run](https://github.com/Faheem1805/Unipath/actions/runs/40084289991)

The workflow checks the repository on pushes and pull requests. It does not deploy to Azure or use the application's database on my VM.

## Project Status and Cleanup

The first milestone is complete: a private Azure deployment, persistence and outage exercises, a tested database restore, an off-VM backup with a matching checksum, and passing GitHub CI.

Cleanup has not yet been recorded as complete, so there is no final teardown date. The dedicated lab resources include the VM, OS disk, public IP, network interface, virtual network, network security group, and Azure SSH public-key resource. The repository's read-only VM deploy key is separate from the local account SSH key used for development.

The next cleanup decision is whether to retain the deployment temporarily or delete the dedicated resource group after confirming that its resources are no longer needed. A resource group alone does not incur a charge; retained resources such as disks and public IPs can continue to cost money even when VM compute is deallocated.

## Current Limitations

- The application is a private preview accessed through an SSH tunnel.
- It uses the development deployment configuration.
- Public DNS and HTTPS are not configured.
- Backups are manual; scheduling and retention are not configured.
- Auto-shutdown remains unresolved because the portal's Save button was disabled.
- I have not tested zone failover or complete VM recovery.

## Next Steps

1. Review actual Azure costs and record the teardown date if the lab is removed.
2. Rebuild the infrastructure using Terraform as the next learning milestone.
3. Prepare and test the production configuration, then configure public DNS and HTTPS.
4. Add monitoring, alerts, and scheduled backups with retention.
5. Develop and test a deployment and rollback pipeline.
