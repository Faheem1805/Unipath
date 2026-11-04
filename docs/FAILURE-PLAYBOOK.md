# Project 1 failure playbook

The observed cases below come from the [manual Azure deployment](CLOUD-LEARNING.md). The practice cases are hypothetical. In an interview, describe what you personally ran, what the project record shows, and what you would test next.

## Project 1 — Manual Azure VM deployment

| Observed symptom                                                                                           | Diagnosis, response, and evidence                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Azure rejected a VM size in UAE North with `NotAvailableForSubscription`.                                  | Region permissions, family quota, and SKU availability are separate checks. The working deployment used Denmark East after checking the subscription's options.                        |
| GitHub rejected HTTPS cloning with an account password.                                                    | The VM needed its own repository credential. A read-only deploy key scoped to UniPath allowed cloning. That key was separate from the key used to log into the VM.                     |
| WSL SSH rejected a private key stored in Windows Downloads.                                                | OpenSSH reported overly broad permissions. Moving the key into WSL's Linux home and setting the directory to `700` and key to `600` resolved it. This was a local key-file problem.    |
| GitHub Actions failed on a Docker test that reserved a fixed container IP, then on `compose start --wait`. | The disposable network needed an explicit subnet. The runner's Compose version also rejected that command form. The test used `up -d --no-deps --wait`, and both CI jobs later passed. |
| The API process stayed alive when PostgreSQL stopped.                                                      | This was a deliberate outage exercise. Liveness stayed responsive while readiness returned 503. Restarting PostgreSQL restored readiness without restarting the API.                   |

**Interview prompt — How did you prove the database was recoverable?** The project restored a custom-format dump into a separate database, matched counts for four tables, and compared SHA-256 hashes after copying the dump off the VM. That exercise verified a logical restore. The full application recovery was tested in project two.

### Project 1 practice cases

| Scenario                                                                | How to diagnose and recover                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The browser cannot open the SSH tunnel endpoint.                        | First run `curl -i http://127.0.0.1:8080/health/ready` on the VM. If it passes, check the local forwarding command and whether port 8080 is already occupied locally. If the VM-side request fails, inspect `sudo docker compose ps -a` and the service logs.                                                                     |
| The API returns 502 through Nginx after the API container was replaced. | Compare the API's health inside its container with readiness through Nginx. Check both services' logs and verify Docker DNS resolves the backend service name. A stale upstream address is one possible cause. Reproduce it by replacing the backend in a disposable stack and checking the proxied endpoint.                     |
| UniPath starts with an empty database after a cleanup command.          | Check the Compose project name and mounted volume. `docker compose down -v` can remove the project's named data volume. Restore a verified dump into a fresh database and confirm records and readiness. Rehearse using a throwaway stack. [Docker Compose reference](https://docs.docker.com/reference/cli/docker/compose/down/) |

For project two, see the [Terraform failure playbook](https://github.com/Faheem1805/UniPath-Azure-Terraform/blob/main/docs/FAILURE-PLAYBOOK.md).
